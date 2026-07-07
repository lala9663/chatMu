/**
 * Spotify 계정 연동 (재생 감지용).
 * 흐름: Spotify authorize → code 수신 → spotify-connect Edge Function이 토큰 교환·저장.
 * client secret은 Edge Function에만 있다. 여기는 client_id(공개값)만 사용.
 */
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SCOPES = "user-read-currently-playing user-read-playback-state";
const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;

/** 웹: http://127.0.0.1:8081/spotify-callback, 네이티브: chatmu://spotify-callback */
function redirectUri(): string {
  return Linking.createURL("spotify-callback");
}

function buildAuthorizeUrl(): string {
  if (!clientId) throw new Error("EXPO_PUBLIC_SPOTIFY_CLIENT_ID가 설정되지 않았습니다");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

export async function startSpotifyConnect(): Promise<void> {
  const url = buildAuthorizeUrl();

  if (Platform.OS === "web") {
    // 같은 탭에서 이동 → 콜백도 같은 탭으로 돌아옴 (App.tsx가 code 처리)
    (globalThis as { location?: { assign(u: string): void } }).location?.assign(url);
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(url, redirectUri());
  if (result.type !== "success") return; // 유저 취소
  const code = new URL(result.url).searchParams.get("code");
  if (!code) throw new Error("콜백에 code가 없습니다");
  await completeSpotifyConnect(code);
}

/** code를 Edge Function에 넘겨 refresh token 저장까지 완료 */
export async function completeSpotifyConnect(code: string): Promise<void> {
  const { error } = await supabase.functions.invoke("spotify-connect", {
    body: { code, redirect_uri: redirectUri() },
  });
  if (error) throw error;
}

/** 현재 유저의 Spotify 연동 여부 */
export async function fetchSpotifyConnected(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase
    .from("users")
    .select("spotify_refresh_token")
    .eq("id", auth.user.id)
    .maybeSingle();
  return Boolean(data?.spotify_refresh_token);
}
