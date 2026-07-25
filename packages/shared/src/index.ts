/**
 * chatMu 공유 도메인 타입.
 * 앱(mobile) / 워커(worker) / 웹 뷰어가 모두 이 타입을 사용한다.
 * DB 스키마 정본: supabase/migrations/0001_initial_schema.sql
 */

export type Platform = "spotify" | "melon" | "youtube_music" | "apple_music" | "genie";

export type PlaySource = "spotify_worker" | "android_listener" | "ios_apple_music";

export interface User {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  preferredPlatform: Platform;
  /** 잠수 모드. false = 잠수 중 → 어떤 감지 경로도 재생 정보를 write하면 안 됨 */
  isSharing: boolean;
  /** 시간 지정 잠수. 이 시각(ISO)까지 공유 중단 */
  sharingPausedUntil: string | null;
}

/** 유저가 현재 공유 중인지. 워커/네이티브 모듈은 write 전에 반드시 이 함수로 판정한다. */
export function isCurrentlySharing(
  user: Pick<User, "isSharing" | "sharingPausedUntil">,
  now: Date = new Date(),
): boolean {
  if (!user.isSharing) return false;
  if (user.sharingPausedUntil !== null && new Date(user.sharingPausedUntil) > now) return false;
  return true;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  createdAt: string;
}

/** 플랫폼 무관 정규화 곡 엔티티 (Odesli 캐시 포함) */
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  odesliId: string | null;
  odesliFetchedAt: string | null;
}

export interface TrackLink {
  trackId: string;
  platform: Platform;
  externalId: string;
  url: string;
}

/** 유저당 1행 upsert */
export interface NowPlaying {
  userId: string;
  trackId: string;
  source: PlaySource;
  isPlaying: boolean;
  detectedAt: string;
}

/** 재생 히스토리 (append only) */
export interface Play {
  id: string;
  userId: string;
  trackId: string;
  source: PlaySource;
  playedAt: string;
  isHidden: boolean;
}

export interface Reaction {
  id: string;
  playId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Message {
  id: string;
  playId: string;
  roomId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  trackId: string;
  fromUserId: string;
  toUserId: string;
  comment: string | null;
  readAt: string | null;
  listenedAt: string | null;
  createdAt: string;
}

/**
 * Android 네이티브 감지 모듈이 JS로 넘기는 재생 이벤트.
 * 최소 표면적: 감지된 곡 메타데이터 + 재생상태만. 업로드/비즈 로직은 JS/Edge Function에서.
 */
export interface DetectedTrack {
  /** 감지된 앱 패키지 (예: com.iloen.melon) */
  packageName: string;
  /** 패키지에서 매핑된 플랫폼 */
  platform: Platform;
  title: string;
  artist: string;
  album: string | null;
  /** content:// 또는 http URI. Bitmap은 이번 범위 제외라 없으면 null */
  artworkUrl: string | null;
  isPlaying: boolean;
  /** 감지 시각 (ISO) */
  detectedAt: string;
}

/** report-play Edge Function 요청 본문 */
export interface ReportPlayRequest {
  platform: Platform;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  isPlaying: boolean;
}

/**
 * Android 감지 곡은 Spotify와 달리 안정적 external_id가 없다.
 * 제목/아티스트를 정규화해 합성키를 만들어 track_links dedup에 쓴다.
 * ⚠️ report-play Edge Function(Deno)은 이 함수를 import할 수 없어 동일 로직을 인라인 복제한다 — 바꾸면 양쪽 다 고칠 것.
 */
export function detectedTrackKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}
