import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { signInWithKakao } from "../lib/auth";

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithKakao();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>chatMu</Text>
      <Text style={styles.subtitle}>지금 듣는 노래, 조용히 같이 듣기</Text>

      <Pressable
        style={[styles.kakaoButton, busy && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={busy}
      >
        <Text style={styles.kakaoButtonText}>
          {busy ? "로그인 중..." : "카카오로 시작하기"}
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  title: { fontSize: 32, fontWeight: "700" },
  subtitle: { fontSize: 14, opacity: 0.6, marginBottom: 32 },
  kakaoButton: {
    backgroundColor: "#FEE500",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  kakaoButtonText: { fontSize: 16, fontWeight: "600", color: "#191919" },
  error: { color: "#d33", fontSize: 13 },
});
