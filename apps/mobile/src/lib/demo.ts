/**
 * 데모 모드: EXPO_PUBLIC_DEMO=1이면 Supabase 없이 목 데이터로 UI를 렌더링한다.
 * 용도: 백엔드 연결 전 UI 확인/디자인 작업. 실서비스 로직에 영향 없음.
 */
import type { FeedItem, RoomMessage } from "../api/feed";
import type { RoomSummary } from "../api/rooms";

export const isDemo = process.env.EXPO_PUBLIC_DEMO === "1";

export const demoRooms: RoomSummary[] = [
  { id: "room-1", name: "우리팀 음악방", code: "MUSIC7" },
  { id: "room-2", name: "대학동기", code: "FRIEND" },
];

export const demoFeed: FeedItem[] = [
  {
    userId: "u1",
    nickname: "민지",
    avatarUrl: null,
    track: {
      id: "t1",
      title: "Supernova",
      artist: "aespa",
      artworkUrl: "https://picsum.photos/seed/supernova/128",
    },
    isPlaying: true,
    detectedAt: new Date(Date.now() - 40_000).toISOString(),
    playId: "p1",
  },
  {
    userId: "u2",
    nickname: "준호",
    avatarUrl: null,
    track: {
      id: "t2",
      title: "Welcome to the Jungle",
      artist: "Guns N' Roses",
      artworkUrl: "https://picsum.photos/seed/jungle/128",
    },
    isPlaying: true,
    detectedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    playId: "p2",
  },
  {
    userId: "u3",
    nickname: "수현",
    avatarUrl: null,
    track: null,
    isPlaying: false,
    detectedAt: null,
    playId: null,
  },
];

export const demoMessages: RoomMessage[] = [
  {
    id: "m1",
    playId: "p1",
    userId: "u2",
    nickname: "준호",
    body: "이거 요즘 계속 듣네 ㅋㅋ",
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    id: "m2",
    playId: "p1",
    userId: "u1",
    nickname: "민지",
    body: "출근길 국룰임",
    createdAt: new Date(Date.now() - 9 * 60_000).toISOString(),
  },
];

export const demoReactions: Record<string, { emoji: string; count: number }[]> = {
  p1: [
    { emoji: "🔥", count: 2 },
    { emoji: "❤️", count: 1 },
  ],
  p2: [{ emoji: "👀", count: 1 }],
};

/** 데모용 곡별 플랫폼 링크. "내 플랫폼으로 열기" UI 흐름을 백엔드 없이 확인 */
export const demoTrackLinks: Record<string, Record<string, string>> = {
  t1: {
    spotify: "https://open.spotify.com/search/Supernova%20aespa",
    youtube_music: "https://music.youtube.com/search?q=Supernova%20aespa",
    apple_music: "https://music.apple.com/search?term=Supernova%20aespa",
  },
  t2: {
    spotify: "https://open.spotify.com/search/Welcome%20to%20the%20Jungle",
    youtube_music: "https://music.youtube.com/search?q=Welcome%20to%20the%20Jungle",
  },
};
