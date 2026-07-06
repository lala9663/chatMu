// 곡 추천 수신자에게 Expo Push 발송.
// "직접 추천"이 유일한 알림 예외 — 다른 이벤트에 이 함수를 재사용하지 말 것 (조용한 존재감 원칙).
import { adminClient, json } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  // DB webhook 또는 서비스 롤 호출 전용
  const secret = req.headers.get("x-function-secret");
  if (secret !== Deno.env.get("PUSH_FUNCTION_SECRET")) return json({ error: "forbidden" }, 403);

  const { recommendation_id } = (await req.json()) as { recommendation_id?: string };
  if (!recommendation_id) return json({ error: "recommendation_id required" }, 400);

  const admin = adminClient();

  const { data: rec } = await admin
    .from("recommendations")
    .select("to_user_id, from_user_id, comment, track_id")
    .eq("id", recommendation_id)
    .maybeSingle();
  if (!rec) return json({ error: "recommendation not found" }, 404);

  const [{ data: recipient }, { data: sender }, { data: track }] = await Promise.all([
    admin.from("users").select("expo_push_token").eq("id", rec.to_user_id).single(),
    admin.from("users").select("nickname").eq("id", rec.from_user_id).single(),
    admin.from("tracks").select("title, artist").eq("id", rec.track_id).single(),
  ]);

  if (!recipient?.expo_push_token) return json({ ok: true, skipped: "no push token" });

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipient.expo_push_token,
      title: `${sender?.nickname ?? "친구"}의 곡 추천`,
      body: track ? `${track.title} — ${track.artist}` : "새 추천곡이 도착했어요",
      data: { type: "recommendation", recommendation_id },
    }),
  });
  if (!res.ok) return json({ error: `expo push failed: ${res.status}` }, 500);

  return json({ ok: true });
});
