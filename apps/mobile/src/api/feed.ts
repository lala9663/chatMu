import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface FeedItem {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  track: { id: string; title: string; artist: string; artworkUrl: string | null } | null;
  isPlaying: boolean;
  detectedAt: string | null;
  /** 반응/채팅이 귀속되는 최신 재생 이벤트 */
  playId: string | null;
}

export interface RoomMessage {
  id: string;
  playId: string;
  userId: string;
  nickname: string;
  body: string;
  createdAt: string;
}

export async function fetchFeed(roomId: string): Promise<FeedItem[]> {
  // 1. 방 멤버
  const { data: members, error: membersError } = await supabase
    .from("room_members")
    .select("user_id, users(nickname, avatar_url)")
    .eq("room_id", roomId);
  if (membersError) throw membersError;

  const userIds = members.map((m) => m.user_id);
  if (userIds.length === 0) return [];

  // 2. 현재 재생 상태 (잠수 중인 유저는 RLS가 걸러줌)
  const { data: playing, error: playingError } = await supabase
    .from("now_playing")
    .select("user_id, is_playing, detected_at, tracks(id, title, artist, artwork_url)")
    .in("user_id", userIds);
  if (playingError) throw playingError;

  // 3. 유저별 최신 재생 이벤트 (반응/채팅 귀속용)
  const { data: recentPlays, error: playsError } = await supabase
    .from("plays")
    .select("id, user_id, track_id")
    .in("user_id", userIds)
    .order("played_at", { ascending: false })
    .limit(userIds.length * 5);
  if (playsError) throw playsError;

  return members.map((member) => {
    const users = member.users as unknown as { nickname: string; avatar_url: string | null };
    const np = playing.find((p) => p.user_id === member.user_id);
    const track = np?.tracks as unknown as
      | { id: string; title: string; artist: string; artwork_url: string | null }
      | undefined;
    const latestPlay = recentPlays.find(
      (p) => p.user_id === member.user_id && (!track || p.track_id === track.id),
    );

    return {
      userId: member.user_id,
      nickname: users.nickname,
      avatarUrl: users.avatar_url,
      track: track
        ? { id: track.id, title: track.title, artist: track.artist, artworkUrl: track.artwork_url }
        : null,
      isPlaying: np?.is_playing ?? false,
      detectedAt: np?.detected_at ?? null,
      playId: latestPlay?.id ?? null,
    };
  });
}

export async function fetchMessages(roomId: string, limit = 50): Promise<RoomMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, play_id, user_id, body, created_at, users(nickname)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data
    .map((m) => ({
      id: m.id,
      playId: m.play_id,
      userId: m.user_id,
      nickname: (m.users as unknown as { nickname: string }).nickname,
      body: m.body,
      createdAt: m.created_at,
    }))
    .reverse();
}

export async function sendMessage(roomId: string, playId: string, body: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");

  const { error } = await supabase
    .from("messages")
    .insert({ room_id: roomId, play_id: playId, user_id: auth.user.id, body });
  if (error) throw error;
}

/** 이모지 반응 토글: 이미 있으면 삭제, 없으면 추가 */
export async function toggleReaction(playId: string, emoji: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("play_id", playId)
    .eq("user_id", auth.user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("reactions")
      .insert({ play_id: playId, user_id: auth.user.id, emoji });
    if (error) throw error;
  }
}

export async function fetchReactions(
  playIds: string[],
): Promise<Record<string, { emoji: string; count: number }[]>> {
  if (playIds.length === 0) return {};
  const { data, error } = await supabase
    .from("reactions")
    .select("play_id, emoji")
    .in("play_id", playIds);
  if (error) throw error;

  const grouped: Record<string, Record<string, number>> = {};
  for (const r of data) {
    grouped[r.play_id] ??= {};
    grouped[r.play_id]![r.emoji] = (grouped[r.play_id]![r.emoji] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(grouped).map(([playId, emojis]) => [
      playId,
      Object.entries(emojis).map(([emoji, count]) => ({ emoji, count })),
    ]),
  );
}

/** 피드 관련 테이블 변경 구독. 반환된 channel은 화면 unmount 시 removeChannel로 해제 */
export function subscribeFeed(roomId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`room-feed-${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "now_playing" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "plays" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, onChange)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
      onChange,
    )
    .subscribe();
}
