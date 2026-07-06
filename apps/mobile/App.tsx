import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ensureProfile } from "./src/lib/auth";
import { supabase } from "./src/lib/supabase";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RoomFeedScreen } from "./src/screens/RoomFeedScreen";
import { RoomsScreen } from "./src/screens/RoomsScreen";
import { useNavStore } from "./src/stores/navStore";

const queryClient = new QueryClient();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const screen = useNavStore((s) => s.screen);
  const navigate = useNavStore((s) => s.navigate);

  useEffect(() => {
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
        {!session ? (
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
