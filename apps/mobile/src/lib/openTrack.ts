/**
 * "내 플랫폼으로 열기" — 피드의 곡을 보는 사람 본인의 플랫폼에서 연다.
 * 직접 링크가 있으면 그걸로, 없으면 Odesli 해석(rate limit 아끼려 탭 시점 lazy),
 * 그래도 없으면 해당 플랫폼 검색으로 fallback → 어느 플랫폼 유저든 "내 앱에서" 열림 보장.
 */
import { Linking } from "react-native";

import type { Platform } from "@chatmu/shared";

import { demoTrackLinks, isDemo } from "./demo";
import { supabase } from "./supabase";

/** Odesli가 직접 링크를 주는 플랫폼 (멜론/지니는 미지원 → 검색 fallback) */
const ODESLI_COVERED: readonly Platform[] = ["spotify", "apple_music", "youtube_music"];

export interface OpenableTrack {
  id: string;
  title: string;
  artist: string;
}

/** 직접 링크가 없을 때 각 플랫폼의 검색 URL — 유저를 본인 앱의 검색으로 보냄 */
function platformSearchUrl(platform: Platform, title: string, artist: string): string {
  const q = encodeURIComponent(`${title} ${artist}`);
  const urls: Record<Platform, string> = {
    spotify: `https://open.spotify.com/search/${q}`,
    melon: `https://www.melon.com/search/total/index.htm?q=${q}`,
    genie: `https://www.genie.co.kr/search/searchMain?query=${q}`,
    youtube_music: `https://music.youtube.com/search?q=${q}`,
    apple_music: `https://music.apple.com/search?term=${q}`,
  };
  return urls[platform];
}

async function fetchTrackLinks(trackId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("track_links")
    .select("platform, url")
    .eq("track_id", trackId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((l) => [l.platform, l.url]));
}

async function resolveTrackLinks(trackId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.functions.invoke("resolve-track-links", {
    body: { track_id: trackId },
  });
  if (error) throw error;
  return (data as { links: Record<string, string> }).links;
}

export async function openTrack(track: OpenableTrack, preferredPlatform: Platform): Promise<void> {
  if (isDemo) {
    const url =
      demoTrackLinks[track.id]?.[preferredPlatform] ??
      platformSearchUrl(preferredPlatform, track.title, track.artist);
    await Linking.openURL(url);
    return;
  }

  let links = await fetchTrackLinks(track.id);

  // 직접 링크가 없고 Odesli가 지원하는 플랫폼이면 해석 시도(1회 → 캐싱됨)
  if (!links[preferredPlatform] && ODESLI_COVERED.includes(preferredPlatform)) {
    try {
      links = await resolveTrackLinks(track.id);
    } catch {
      // 해석 실패 → 검색 fallback으로 진행
    }
  }

  const url =
    links[preferredPlatform] ?? platformSearchUrl(preferredPlatform, track.title, track.artist);
  await Linking.openURL(url);
}
