import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedItem } from "../api/feed";

const QUICK_EMOJIS = ["🔥", "❤️", "😂", "👀"];

interface Props {
  item: FeedItem;
  reactions: { emoji: string; count: number }[];
  onReact: (playId: string, emoji: string) => void;
  onOpenChat: (playId: string) => void;
  onOpen: (track: { id: string; title: string; artist: string }) => void;
}

export function NowPlayingCard({ item, reactions, onReact, onOpenChat, onOpen }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {item.track?.artworkUrl ? (
          <Image source={{ uri: item.track.artworkUrl }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]}>
            <Text style={styles.artworkPlaceholderText}>♪</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.nickname}>{item.nickname}</Text>
          {item.track ? (
            <>
              <Text style={styles.trackTitle} numberOfLines={1}>{item.track.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{item.track.artist}</Text>
              {item.detectedAt && (
                <Text style={styles.detectedAt}>{formatDetectedAt(item.detectedAt)}</Text>
              )}
            </>
          ) : (
            <Text style={styles.idle}>지금은 조용하네요</Text>
          )}
        </View>

        {item.track && (
          <Pressable
            style={styles.openButton}
            onPress={() =>
              onOpen({ id: item.track!.id, title: item.track!.title, artist: item.track!.artist })
            }
          >
            <Text style={styles.openButtonText}>🎧 내 플랫폼{"\n"}으로 열기</Text>
          </Pressable>
        )}
      </View>

      {item.playId && (
        <View style={styles.actions}>
          {QUICK_EMOJIS.map((emoji) => {
            const count = reactions.find((r) => r.emoji === emoji)?.count ?? 0;
            return (
              <Pressable
                key={emoji}
                style={styles.emojiButton}
                onPress={() => onReact(item.playId!, emoji)}
              >
                <Text style={styles.emojiText}>
                  {emoji}
                  {count > 0 ? ` ${count}` : ""}
                </Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.chatButton} onPress={() => onOpenChat(item.playId!)}>
            <Text style={styles.chatButtonText}>💬</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** "마지막 감지 시각" 표시 — iOS 등 감지가 실시간이 아닐 수 있어 기대치 관리용 */
function formatDetectedAt(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "방금 감지됨";
  if (diffMin < 60) return `${diffMin}분 전 감지됨`;
  return `${Math.floor(diffMin / 60)}시간 전 감지됨`;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#f9f9fa", borderRadius: 16, padding: 14, marginBottom: 10 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  artwork: { width: 64, height: 64, borderRadius: 8 },
  artworkPlaceholder: { backgroundColor: "#e4e4e7", alignItems: "center", justifyContent: "center" },
  artworkPlaceholderText: { fontSize: 24, opacity: 0.4 },
  info: { flex: 1, justifyContent: "center" },
  nickname: { fontSize: 12, fontWeight: "600", opacity: 0.6 },
  trackTitle: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  artist: { fontSize: 13, opacity: 0.7 },
  detectedAt: { fontSize: 11, opacity: 0.4, marginTop: 2 },
  idle: { fontSize: 13, opacity: 0.4, marginTop: 6 },
  openButton: {
    backgroundColor: "#191919",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "center",
  },
  openButtonText: { color: "#fff", fontWeight: "600", fontSize: 12, textAlign: "center" },
  actions: { flexDirection: "row", gap: 6, marginTop: 10 },
  emojiButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#eee",
  },
  emojiText: { fontSize: 13 },
  chatButton: {
    marginLeft: "auto",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#eee",
  },
  chatButtonText: { fontSize: 13 },
});
