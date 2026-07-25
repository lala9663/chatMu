/** 네이티브 onTrackChanged 이벤트 페이로드 (detectedAt은 JS 수신 시점에 stamp) */
export type DetectedTrackEvent = {
  packageName: string;
  /** PackagePlatformMap에서 매핑된 값 — youtube_music | melon | genie */
  platform: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  isPlaying: boolean;
};

export type MediaDetectorModuleEvents = {
  onTrackChanged: (event: DetectedTrackEvent) => void;
};
