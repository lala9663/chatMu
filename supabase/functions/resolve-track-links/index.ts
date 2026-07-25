// track_id를 받아 Odesli로 전 플랫폼 링크를 확보/캐싱하고 반환. "내 플랫폼으로 열기"의 서버 몫.
// lazy: 실제로 열려는 곡만 호출 → Odesli 무료 티어 rate limit 절약 (CLAUDE.md: 캐시 히트 우선).
// 주의: Odesli는 멜론/지니 미지원 → spotify/apple_music/youtube_music만 채워질 수 있음.
//       나머지는 클라이언트가 플랫폼 검색 URL로 fallback.
import { adminClient, getCaller, handleOptions, json } from "../_shared/admin.ts";

// Odesli 응답 플랫폼 키 → chatMu 플랫폼
const ODESLI_PLATFORM_MAP: Record<string, string> = {
  spotify: "spotify",
  appleMusic: "apple_music",
  youtubeMusic: "youtube_music",
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const caller = await getCaller(req);
  if (!caller) return json({ error: "unauthorized" }, 401);

  const { track_id } = (await req.json()) as { track_id?: string };
  if (!track_id) return json({ error: "track_id required" }, 400);

  const admin = adminClient();

  const { data: track } = await admin
    .from("tracks")
    .select("id, odesli_fetched_at")
    .eq("id", track_id)
    .maybeSingle();
  if (!track) return json({ error: "track not found" }, 404);

  // 캐시 히트: 이미 해석됨이면 Odesli 재호출 없이 현재 링크 반환
  if (track.odesli_fetched_at) {
    return json({ links: await getLinks(admin, track_id) });
  }

  // 해석 가능한 정규 URL 찾기 (song.link 검색 fallback은 Odesli 입력으로 못 씀)
  const { data: existingLinks } = await admin
    .from("track_links")
    .select("platform, url")
    .eq("track_id", track_id);
  const seed = (existingLinks ?? []).find((l) => !l.url.includes("song.link/search"));
  if (!seed) {
    // Android 텍스트 감지 곡 등 — 해석할 씨앗 URL이 없음. 현재 링크만 반환.
    return json({ links: await getLinks(admin, track_id) });
  }

  // Odesli 호출 (실패 시 graceful degradation: 기존 링크만 반환)
  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(seed.url)}`,
    );
    if (res.ok) {
      const odesli = (await res.json()) as {
        entityUniqueId: string;
        linksByPlatform: Record<string, { url: string; entityUniqueId: string }>;
      };

      const rows = Object.entries(ODESLI_PLATFORM_MAP).flatMap(([odesliKey, ours]) => {
        const link = odesli.linksByPlatform[odesliKey];
        return link ? [{ track_id, platform: ours, external_id: link.entityUniqueId, url: link.url }] : [];
      });

      if (rows.length > 0) {
        const { error: linkErr } = await admin
          .from("track_links")
          .upsert(rows, { onConflict: "track_id,platform" });
        if (linkErr) return json({ error: linkErr.message }, 500);
      }

      await admin
        .from("tracks")
        .update({ odesli_id: odesli.entityUniqueId, odesli_fetched_at: new Date().toISOString() })
        .eq("id", track_id);
    }
  } catch (_err) {
    // 네트워크/rate limit 실패 — 기존 링크만이라도 반환
  }

  return json({ links: await getLinks(admin, track_id) });
});

async function getLinks(
  admin: ReturnType<typeof adminClient>,
  trackId: string,
): Promise<Record<string, string>> {
  const { data } = await admin.from("track_links").select("platform, url").eq("track_id", trackId);
  return Object.fromEntries((data ?? []).map((l) => [l.platform, l.url]));
}
