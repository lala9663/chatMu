import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text } from "react-native";

import {
  getPermissionStatus,
  isDetectionAvailable,
  openPermissionSettings,
} from "../../modules/media-detector";

/**
 * Android에서 알림 접근이 아직 허용되지 않았을 때 뜨는 안내 배너.
 * 런타임 팝업이 아니라 설정 화면 진입이 필요해서, 왜 필요한지 설명하고 설정으로 보낸다.
 * 설정에서 켜고 앱으로 돌아오면(AppState active) 자동으로 사라진다.
 */
export function DetectionBanner() {
  const [granted, setGranted] = useState(true); // 확인 전엔 숨김(깜빡임 방지)

  useEffect(() => {
    if (!isDetectionAvailable()) return;
    const check = () => setGranted(getPermissionStatus());
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, []);

  if (!isDetectionAvailable() || granted) return null;

  return (
    <Pressable style={styles.banner} onPress={openPermissionSettings}>
      <Text style={styles.title}>🎵 듣는 곡 자동 공유 켜기</Text>
      <Text style={styles.body}>
        유튜브뮤직·멜론·지니에서 재생하는 곡을 자동으로 공유하려면 알림 접근 권한이 필요해요.
        눌러서 설정에서 chatMu를 켜주세요.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  title: { fontWeight: "700", fontSize: 14, marginBottom: 4 },
  body: { fontSize: 12, opacity: 0.7, lineHeight: 17 },
});
