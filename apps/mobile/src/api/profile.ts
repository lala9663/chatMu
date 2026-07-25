import type { Platform } from "@chatmu/shared";

import { isDemo } from "../lib/demo";
import { supabase } from "../lib/supabase";

/** 본인 선호 플랫폼. 미설정 시 기본 'spotify'. (설정 UI는 이후 단계) */
export async function fetchMyPreferredPlatform(): Promise<Platform> {
  if (isDemo) return "spotify";
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "spotify";
  const { data } = await supabase
    .from("users")
    .select("preferred_platform")
    .eq("id", auth.user.id)
    .maybeSingle();
  return (data?.preferred_platform as Platform | undefined) ?? "spotify";
}
