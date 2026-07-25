import { requireOptionalNativeModule } from "expo";
import type { EventSubscription } from "expo-modules-core";

import type { DetectedTrackEvent } from "./MediaDetector.types";

/** 사용하는 메서드만 명시 선언 (NativeModule 클래스 확장은 SDK 타입과 충돌해서 지양) */
interface MediaDetectorNativeModule {
  getPermissionStatus(): boolean;
  openPermissionSettings(): void;
  addListener(
    eventName: "onTrackChanged",
    listener: (event: DetectedTrackEvent) => void,
  ): EventSubscription;
}

// Android에만 네이티브 모듈이 존재. 웹/iOS에서는 null → 아래 헬퍼가 안전하게 no-op.
const MediaDetector = requireOptionalNativeModule<MediaDetectorNativeModule>("MediaDetector");

/** 이 기기에서 감지 기능을 쓸 수 있는지 (Android + 네이티브 모듈 존재) */
export function isDetectionAvailable(): boolean {
  return MediaDetector != null;
}

/** 알림 접근 권한이 허용됐는지 */
export function getPermissionStatus(): boolean {
  return MediaDetector?.getPermissionStatus() ?? false;
}

/** 알림 접근 설정 화면 열기 (런타임 팝업 불가 → 설정 진입) */
export function openPermissionSettings(): void {
  MediaDetector?.openPermissionSettings();
}

/** 감지 이벤트 구독. 미지원 기기에서는 null 반환. 해제는 subscription.remove() */
export function addTrackChangedListener(
  listener: (event: DetectedTrackEvent) => void,
): EventSubscription | null {
  return MediaDetector?.addListener("onTrackChanged", listener) ?? null;
}

export type { DetectedTrackEvent } from "./MediaDetector.types";
