// Android 네이티브 감지(유튜브뮤직/멜론/지니)로 잡힌 재생을 기록.
// 클라이언트는 tracks에 직접 insert 불가(RLS) → 서비스 롤로 곡 find-or-create + now_playing/plays 기록.
// 역할 경계: Spotify 워커(apps/worker/src/db.ts)의 상태 쓰기 로직과 동일. Odesli 변환은 이후 단계(여기 얹을 예정).
import { adminClient, getCaller, handleOptions, json } from "../_shared/admin.ts";

const PLATFORMS = ["spotify", "melon", "youtube_music", "apple_music", "genie"];

interface ReportPlayBody {
  platform?: string;
  title?: string;
  artist?: string;
  album?: string | null;
  artworkUrl?: string | null;
  isPlaying?: boolean;
}

/** @chatmu/shared의 detectedTrackKey와 동일 로직 (Deno라 import 불가 — 바꾸면 양쪽 다 고칠 것) */
function detectedTrackKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const caller = await getCaller(req);
  if (!caller) return json({ error: "unauthorized" }, 401);

  const body = (await req.json()) as ReportPlayBody;
  const { platform, title, artist } = body;
  const album = body.album ?? null;
  const artworkUrl = body.artworkUrl ?? null;
  const isPlaying = body.isPlaying ?? true;

  if (!platform || !PLATFORMS.includes(platform)) {
    return json({ error: "valid platform required" }, 400);
  }
  if (!title || !artist) return json({ error: "title and artist required" }, 400);

  const admin = adminClient();

  // 잠수 모드 방어 1차: 공유 OFF면 조용히 무시 (DB 트리거가 2차 방어)
  const { data: me } = await admin
    .from("users")
    .select("is_sharing, sharing_paused_until")
    .eq("id", caller.id)
    .maybeSingle();
  if (!me) return json({ error: "profile not found" }, 404);
  const paused =
    me.is_sharing === false ||
    (me.sharing_paused_until !== null && new Date(me.sharing_paused_until) > new Date());
  if (paused) return json({ ok: true, skipped: "sharing paused" });

  // 1. 합성키로 기존 track 조회
  const externalId = detectedTrackKey(title, artist);
  const { data: link } = await admin
    .from("track_links")
    .select("track_id")
    .eq("platform", platform)
    .eq("external_id", externalId)
    .maybeSingle();

  let trackId = link?.track_id as string | undefined;

  // 2. 없으면 track + track_link 생성 (원본 플랫폼 링크만 — Odesli는 이후 단계)
  if (!trackId) {
    const { data: track, error: trackErr } = await admin
      .from("tracks")
      .insert({ title, artist, album, artwork_url: artworkUrl })
      .select("id")
      .single();
    if (trackErr) return json({ error: trackErr.message }, 500);
    trackId = track.id as string;

    const { error: linkErr } = await admin.from("track_links").insert({
      track_id: trackId,
      platform,
      external_id: externalId,
      // 감지 곡은 정규 URL이 없어 검색 URL로 대체 (열기 fallback). Odesli 단계에서 교체.
      url: `https://song.link/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
    });
    // (platform, external_id) 동시성 중복은 무시 — 이미 있으면 다음 폴에서 조회로 잡힘
    if (linkErr && !linkErr.message.includes("duplicate")) {
      return json({ error: linkErr.message }, 500);
    }
  }

  // 3. 곡 변경 여부 확인 후 now_playing upsert
  const { data: current } = await admin
    .from("now_playing")
    .select("track_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  const trackChanged = current?.track_id !== trackId;

  const { error: npErr } = await admin.from("now_playing").upsert({
    user_id: caller.id,
    track_id: trackId,
    source: "android_listener",
    is_playing: isPlaying,
    detected_at: new Date().toISOString(),
  });
  if (npErr) return json({ error: npErr.message }, 500);

  // 4. 곡이 바뀐 경우에만 히스토리 append
  if (trackChanged) {
    const { error: playErr } = await admin.from("plays").insert({
      user_id: caller.id,
      track_id: trackId,
      source: "android_listener",
    });
    if (playErr) return json({ error: playErr.message }, 500);
  }

  return json({ track_id: trackId });
});
