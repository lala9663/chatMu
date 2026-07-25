import { useEffect } from "react";
import { AppState } from "react-native";

import { getPermissionStatus, isDetectionAvailable } from "../../modules/media-detector";
import { startMediaDetection } from "../lib/mediaDetector";

/**
 * Android + 알림 접근 권한 허용 시 감지 구독을 시작/유지한다. App 최상위에서 1회 호출.
 * 포그라운드 복귀 시 권한을 재확인해(설정에서 켜고 돌아온 경우) 자동으로 시작한다.
 */
export function useMediaDetectionAutostart(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !isDetectionAvailable()) return;

    let stop: (() => void) | null = null;

    const sync = () => {
      const granted = getPermissionStatus();
      if (granted && !stop) {
        stop = startMediaDetection();
      } else if (!granted && stop) {
        stop();
        stop = null;
      }
    };

    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => {
      subscription.remove();
      stop?.();
    };
  }, [enabled]);
}
