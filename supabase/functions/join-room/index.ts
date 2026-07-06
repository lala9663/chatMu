// 방 코드 검증 후 입장. 코드가 맞으면 room_members insert (idempotent).
import { adminClient, getCaller, json } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "unauthorized" }, 401);

  const { code } = (await req.json()) as { code?: string };
  if (!code || typeof code !== "string") return json({ error: "code required" }, 400);

  const admin = adminClient();

  const { data: room } = await admin
    .from("rooms")
    .select("id, name")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!room) return json({ error: "room not found" }, 404);

  // 이미 멤버여도 성공 (idempotent)
  const { error } = await admin
    .from("room_members")
    .upsert({ room_id: room.id, user_id: caller.id }, { onConflict: "room_id,user_id" });
  if (error) return json({ error: error.message }, 500);

  return json({ room_id: room.id, name: room.name });
});
