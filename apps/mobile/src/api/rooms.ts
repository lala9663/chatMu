import { supabase } from "../lib/supabase";

export interface RoomSummary {
  id: string;
  name: string;
  code: string;
}

export async function fetchMyRooms(): Promise<RoomSummary[]> {
  const { data, error } = await supabase.from("rooms").select("id, name, code");
  if (error) throw error;
  return data;
}

/** 방 생성 + 본인 멤버 등록. 6자리 코드 자동 발급 */
export async function createRoom(name: string): Promise<RoomSummary> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");

  const code = generateRoomCode();
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({ name, code, created_by: auth.user.id })
    .select("id, name, code")
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, user_id: auth.user.id });
  if (memberError) throw memberError;

  return room;
}

/** 방 코드로 입장 — 코드 검증은 join-room Edge Function (RLS상 비멤버는 rooms를 못 읽으므로) */
export async function joinRoomByCode(code: string): Promise<{ room_id: string; name: string }> {
  const { data, error } = await supabase.functions.invoke("join-room", {
    body: { code: code.trim().toUpperCase() },
  });
  if (error) throw error;
  return data as { room_id: string; name: string };
}

function generateRoomCode(): string {
  // 혼동 문자(0/O, 1/I) 제외
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}
