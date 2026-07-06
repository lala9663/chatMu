/** Supabase 쓰기 레이어. 워커는 서비스 롤로 접근하지만, 잠수 모드 체크는 호출부(index.ts)에서 선행된다. */
import { createClient } from "@supabase/supabase-js";
import type { SpotifyPlaying } from "./spotify.js";

const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

export interface SpotifyConnectedUser {
  id: string;
  spotifyRefreshToken: string;
  isSharing: boolean;
  sharingPausedUntil: string | null;
}

export async function getSpotifyConnectedUsers(): Promise<SpotifyConnectedUser[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, spotify_refresh_token, is_sharing, sharing_paused_until")
    .not("spotify_refresh_token", "is", null);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    spotifyRefreshToken: row.spotify_refresh_token as string,
    isSharing: row.is_sharing as boolean,
    sharingPausedUntil: row.sharing_paused_until as string | null,
  }));
}

/**
 * 곡을 tracks에 확보(upsert)하고 now_playing 갱신 + 곡이 바뀐 경우 plays append.
 * Odesli 전 플랫폼 링크 변환은 resolve-track Edge Function 몫 — 워커는 Spotify 정보만 쓴다.
 */
export async function upsertNowPlaying(userId: string, playing: SpotifyPlaying): Promise<void> {
  // 1. spotify external_id로 기존 track 조회
  const { data: link } = await supabase
    .from("track_links")
    .select("track_id")
    .eq("platform", "spotify")
    .eq("external_id", playing.spotifyTrackId)
    .maybeSingle();

  let trackId = link?.track_id as string | undefined;

  // 2. 없으면 track + track_link 생성
  if (!trackId) {
    const { data: track, error: trackErr } = await supabase
      .from("tracks")
      .insert({
        title: playing.title,
        artist: playing.artist,
        album: playing.album,
        artwork_url: playing.artworkUrl,
      })
      .select("id")
      .single();
    if (trackErr) throw trackErr;
    trackId = track.id as string;

    const { error: linkErr } = await supabase.from("track_links").insert({
      track_id: trackId,
      platform: "spotify",
      external_id: playing.spotifyTrackId,
      url: `https://open.spotify.com/track/${playing.spotifyTrackId}`,
    });
    if (linkErr) throw linkErr;
  }

  // 3. 곡이 바뀌었는지 확인 후 now_playing upsert
  const { data: current } = await supabase
    .from("now_playing")
    .select("track_id")
    .eq("user_id", userId)
    .maybeSingle();

  const trackChanged = current?.track_id !== trackId;

  const { error: npErr } = await supabase.from("now_playing").upsert({
    user_id: userId,
    track_id: trackId,
    source: "spotify_worker",
    is_playing: playing.isPlaying,
    detected_at: new Date().toISOString(),
  });
  if (npErr) throw npErr;

  // 4. 곡이 바뀐 경우에만 히스토리 append
  if (trackChanged) {
    const { error: playErr } = await supabase.from("plays").insert({
      user_id: userId,
      track_id: trackId,
      source: "spotify_worker",
    });
    if (playErr) throw playErr;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing env: ${name}`);
  return value;
}
