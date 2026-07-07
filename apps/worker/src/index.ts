/**
 * chatMu Spotify 폴링 워커.
 *
 * 역할: "Spotify 상태를 DB에 쓰기"만 담당한다. API/비즈니스 로직을 여기 넣지 말 것.
 * 흐름: 연동 유저 조회 → 잠수 모드 유저 스킵 → currently-playing 폴링 → now_playing upsert + plays append.
 */
import { isCurrentlySharing } from "@chatmu/shared";
import { fetchCurrentlyPlaying, refreshAccessToken } from "./spotify.js";
import { getSpotifyConnectedUsers, upsertNowPlaying } from "./db.js";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 45_000);

// 유저별 access token 캐시 (만료 시 refresh)
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

async function pollOnce(): Promise<void> {
  const users = await getSpotifyConnectedUsers();
  console.log(`[poll] Spotify 연동 유저 ${users.length}명`);

  for (const user of users) {
    // 잠수 모드 크리티컬 규칙: 폴링 자체를 스킵한다 (조회조차 하지 않음)
    if (!isCurrentlySharing(user)) continue;

    try {
      let cached = tokenCache.get(user.id);
      if (!cached || cached.expiresAt <= Date.now() + 10_000) {
        const refreshed = await refreshAccessToken(user.spotifyRefreshToken);
        cached = {
          accessToken: refreshed.accessToken,
          expiresAt: Date.now() + refreshed.expiresInSec * 1000,
        };
        tokenCache.set(user.id, cached);
      }

      const playing = await fetchCurrentlyPlaying(cached.accessToken);
      if (playing) {
        await upsertNowPlaying(user.id, playing);
        console.log(`[poll] user=${user.id.slice(0, 8)} ♪ ${playing.title} — ${playing.artist} (playing=${playing.isPlaying})`);
      } else {
        console.log(`[poll] user=${user.id.slice(0, 8)} 재생 중 아님`);
      }
    } catch (err) {
      // 유저 하나의 실패가 전체 폴링을 멈추지 않게 한다
      console.error(`[poll] user=${user.id}`, err instanceof Error ? err.message : err);
    }
  }
}

async function main(): Promise<void> {
  console.log(`chatMu worker started (interval=${POLL_INTERVAL_MS}ms)`);
  for (;;) {
    const started = Date.now();
    await pollOnce();
    const elapsed = Date.now() - started;
    await new Promise((r) => setTimeout(r, Math.max(0, POLL_INTERVAL_MS - elapsed)));
  }
}

main().catch((err) => {
  console.error("worker fatal:", err);
  process.exit(1);
});
