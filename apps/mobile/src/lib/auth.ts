/**
 * 카카오 로그인 (Supabase Auth OAuth).
 * 시크릿 없이 동작 — 카카오 client secret은 Supabase 대시보드에만 등록한다.
 */
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

// 주의: Supabase는 카카오에 항상 account_email scope를 요청한다 (클라이언트에서 제거 불가).
// 따라서 카카오 앱은 비즈 앱(개인 개발자 가능) + 이메일 동의항목 설정이 필수다.

export async function signInWithKakao(): Promise<void> {
  // 웹: 전체 페이지 리다이렉트 방식 (돌아오면 detectSessionInUrl이 세션 처리)
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: Linking.createURL("") }, // http://localhost:8081
    });
    if (error) throw error;
    return;
  }

  const redirectTo = Linking.createURL("auth/callback"); // chatmu://auth/callback

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error("OAuth URL 생성 실패");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return; // 유저가 취소

  // 콜백 URL fragment에서 토큰 추출 → 세션 설정
  const params = new URLSearchParams(result.url.split("#")[1] ?? "");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error("콜백에 토큰이 없습니다");

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** 로그인 직후 users 프로필 행 보장 (없으면 생성) */
export async function ensureProfile(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (existing) return;

  const meta = auth.user.user_metadata;
  const { error } = await supabase.from("users").insert({
    id: auth.user.id,
    nickname: (meta.name as string | undefined) ?? (meta.full_name as string | undefined) ?? "익명",
    avatar_url: (meta.avatar_url as string | undefined) ?? null,
  });
  if (error) throw error;
}
