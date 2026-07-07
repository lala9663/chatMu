/** Spotify Web API 호출. 토큰 refresh와 currently-playing 조회만. */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const CURRENTLY_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";

export interface SpotifyPlaying {
  spotifyTrackId: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  isPlaying: boolean;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresInSec: number }> {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresInSec: json.expires_in };
}

/** 재생 중이 아니면 null. 429/5xx는 호출자가 다음 주기에 재시도. */
export async function fetchCurrentlyPlaying(accessToken: string): Promise<SpotifyPlaying | null> {
  const res = await fetch(CURRENTLY_PLAYING_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204) return null; // 재생 중 아님
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`currently-playing failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    is_playing: boolean;
    item: {
      id: string;
      name: string;
      artists: { name: string }[];
      album: { name: string; images: { url: string }[] };
    } | null;
  };
  if (!json.item) return null; // 팟캐스트 등 트랙이 아닌 경우

  return {
    spotifyTrackId: json.item.id,
    title: json.item.name,
    artist: json.item.artists.map((a) => a.name).join(", "),
    album: json.item.album.name,
    artworkUrl: json.item.album.images[0]?.url ?? null,
    isPlaying: json.is_playing,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing env: ${name}`);
  return value;
}
