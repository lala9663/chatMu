/**
 * Android 네이티브 감지(유튜브뮤직/멜론/지니) → report-play Edge Function 연결.
 * 네이티브는 이벤트만 넘기고, 잠수 모드 존중·업로드는 여기(JS)에서 (CLAUDE.md).
 */
import { isCurrentlySharing, type Platform, type ReportPlayRequest } from "@chatmu/shared";
import {
  addTrackChangedListener,
  type DetectedTrackEvent,
} from "../../modules/media-detector";
import { isDemo } from "./demo";
import { supabase } from "./supabase";

/** 잠수 모드 판정용 최소 상태. 서버(report-play)와 DB 트리거가 최종 방어. */
let sharing: { isSharing: boolean; sharingPausedUntil: string | null } | null = null;

/** 현재 유저의 공유 상태를 새로 읽어 캐시. 감지 시작 시 + 잠수 토글(3단계) 시 호출. */
export async function refreshSharingState(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    sharing = null;
    return;
  }
  const { data } = await supabase
    .from("users")
    .select("is_sharing, sharing_paused_until")
    .eq("id", auth.user.id)
    .maybeSingle();
  sharing = data
    ? { isSharing: data.is_sharing, sharingPausedUntil: data.sharing_paused_until }
    : null;
}

async function handleTrack(event: DetectedTrackEvent): Promise<void> {
  // 잠수 모드 존중(1차, 클라). 상태 미확인이면 서버가 최종 판정하므로 통과시킴.
  if (sharing && !isCurrentlySharing(sharing)) return;

  const body: ReportPlayRequest = {
    // 네이티브는 PackagePlatformMap의 값만 보내므로 Platform으로 안전하게 취급
    platform: event.platform as Platform,
    title: event.title,
    artist: event.artist,
    album: event.album,
    artworkUrl: event.artworkUrl,
    isPlaying: event.isPlaying,
  };

  const { error } = await supabase.functions.invoke("report-play", { body });
  if (error) console.warn("[mediaDetector] report-play 실패:", error.message);
}

/**
 * 감지 구독 시작. 반환된 함수로 해제한다.
 * 데모 모드·미지원 기기(웹/iOS)에서는 no-op.
 */
export function startMediaDetection(): () => void {
  if (isDemo) return () => {};
  void refreshSharingState();
  const subscription = addTrackChangedListener((event) => {
    void handleTrack(event);
  });
  return () => subscription?.remove();
}
