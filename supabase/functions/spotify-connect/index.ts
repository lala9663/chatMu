// Spotify OAuth code를 token으로 교환하고 refresh token을 저장.
// client secret은 함수 환경변수에만 존재 — 클라이언트 번들 노출 금지 원칙.
import { adminClient, getCaller, json } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "unauthorized" }, 401);

  const { code, redirect_uri } = (await req.json()) as { code?: string; redirect_uri?: string };
  if (!code || !redirect_uri) return json({ error: "code and redirect_uri required" }, 400);

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri }),
  });
  if (!res.ok) return json({ error: `spotify token exchange failed: ${res.status}` }, 400);

  const token = (await res.json()) as { refresh_token?: string };
  if (!token.refresh_token) return json({ error: "no refresh_token in response" }, 400);

  const { error } = await adminClient()
    .from("users")
    .update({ spotify_refresh_token: token.refresh_token })
    .eq("id", caller.id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
