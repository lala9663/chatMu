import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ensureProfile } from "./src/lib/auth";
import { isDemo } from "./src/lib/demo";
import { completeSpotifyConnect } from "./src/lib/spotifyConnect";
import { supabase } from "./src/lib/supabase";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RoomFeedScreen } from "./src/screens/RoomFeedScreen";
import { RoomsScreen } from "./src/screens/RoomsScreen";
import { useNavStore } from "./src/stores/navStore";

const queryClient = new QueryClient();

/** 웹 전용: Spotify OAuth 콜백으로 돌아온 경우 URL에서 code를 회수하고 주소를 원복 */
function consumeSpotifyCodeFromUrl(): string | null {
  if (Platform.OS !== "web") return null;
  const g = globalThis as {
    location?: { pathname: string; search: string };
    history?: { replaceState(s: unknown, t: string, u: string): void };
  };
  if (!g.location?.pathname.startsWith("/spotify-callback")) return null;
  const code = new URLSearchParams(g.location.search).get("code");
  g.history?.replaceState(null, "", "/");
  return code;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [spotifyCode, setSpotifyCode] = useState<string | null>(consumeSpotifyCodeFromUrl);
  const screen = useNavStore((s) => s.screen);
  const navigate = useNavStore((s) => s.navigate);

  // 세션이 준비된 뒤에 Spotify code 교환 (함수 호출에 로그인 토큰 필요)
  useEffect(() => {
    if (!session || !spotifyCode) return;
    const code = spotifyCode;
    setSpotifyCode(null);
    completeSpotifyConnect(code)
      .then(() => queryClient.invalidateQueries({ queryKey: ["spotifyStatus"] }))
      .catch((e) => console.error("Spotify 연동 실패:", e));
  }, [session, spotifyCode]);

  useEffect(() => {
    if (isDemo) return; // 데모 모드: 인증 생략
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        void ensureProfile();
      } else {
        navigate({ name: "rooms" }); // 로그아웃 시 초기 화면으로
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.container}>
        {!session && !isDemo ? (
          <LoginScreen />
        ) : screen.name === "roomFeed" ? (
          <RoomFeedScreen roomId={screen.roomId} roomName={screen.roomName} />
        ) : (
          <RoomsScreen />
        )}
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
});
