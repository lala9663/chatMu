import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import { isDemo } from "./demo";

// anon key는 공개 가능 (RLS가 보안 경계). 시크릿은 절대 여기 넣지 말 것.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? (isDemo ? "https://demo.invalid" : undefined);
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (isDemo ? "demo-anon-key" : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 웹은 localStorage 기본값 사용, 네이티브만 AsyncStorage
    ...(Platform.OS !== "web" && { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web", // 네이티브는 딥링크로 직접 처리
  },
});
