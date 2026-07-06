// Odesli로 곡의 전 플랫폼 링크를 확보하고 tracks/track_links에 캐싱.
// 캐시 히트 우선 (Odesli 무료 티어 rate limit). 실패 시 원본 링크만으로 track 생성.
import { adminClient, getCaller, json } from "../_shared/admin.ts";

interface ResolveRequest {
  platform: string;
  external_id: string;
  url: string;
  title: string;
  artist: string;
}

Deno.serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "unauthorized" }, 401);

  const body = (await req.json()) as Partial<ResolveRequest>;
  const { platform, external_id, url, title, artist } = body;
  if (!platform || !external_id || !url || !title || !artist) {
    return json({ error: "platform, external_id, url, title, artist required" }, 400);
  }

  const admin = adminClient();

  // 1. 캐시 조회
  const { data: cached } = await admin
    .from("track_links")
    .select("track_id")
    .eq("platform", platform)
    .eq("external_id", external_id)
    .maybeSingle();

  if (cached) {
    const links = await getLinks(admin, cached.track_id);
    return json({ track_id: cached.track_id, links });
  }

  // 2. 캐시 미스 → Odesli 호출
  let odesliId: string | null = null;
  const platformLinks: { platform: string; external_id: string; url: string }[] = [
    { platform, external_id, url },
  ];

  try {
    const odesliRes = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`,
    );
    if (odesliRes.ok) {
      const odesli = (await odesliRes.json()) as {
        entityUniqueId: string;
        linksByPlatform: Record<string, { url: string; entityUniqueId: string }>;
      };
      odesliId = odesli.entityUniqueId;

      const platformMap: Record<string, string> = {
        spotify: "spotify",
        appleMusic: "apple_music",
        youtubeMusic: "youtube_music",
      };
      for (const [odesliPlatform, ours] of Object.entries(platformMap)) {
        const link = odesli.linksByPlatform[odesliPlatform];
        if (link && ours !== platform) {
          platformLinks.push({ platform: ours, external_id: link.entityUniqueId, url: link.url });
        }
      }
    }
  } catch (_err) {
    // graceful degradation: 원본 플랫폼 링크만으로 진행
  }

  // 3. track + links upsert
  const { data: track, error: trackErr } = await admin
    .from("tracks")
    .insert({ title, artist, odesli_id: odesliId, odesli_fetched_at: odesliId ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (trackErr) return json({ error: trackErr.message }, 500);

  const { error: linkErr } = await admin.from("track_links").upsert(
    platformLinks.map((l) => ({ track_id: track.id, ...l })),
    { onConflict: "track_id,platform" },
  );
  if (linkErr) return json({ error: linkErr.message }, 500);

  const links = await getLinks(admin, track.id);
  return json({ track_id: track.id, links });
});

async function getLinks(
  admin: ReturnType<typeof adminClient>,
  trackId: string,
): Promise<Record<string, string>> {
  const { data } = await admin.from("track_links").select("platform, url").eq("track_id", trackId);
  return Object.fromEntries((data ?? []).map((l) => [l.platform, l.url]));
}
