import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  fetchFeed,
  fetchMessages,
  fetchReactions,
  sendMessage,
  subscribeFeed,
  toggleReaction,
} from "../api/feed";
import { supabase } from "../lib/supabase";
import { useNavStore } from "../stores/navStore";
import { NowPlayingCard } from "../components/NowPlayingCard";

interface Props {
  roomId: string;
  roomName: string;
}

export function RoomFeedScreen({ roomId, roomName }: Props) {
  const navigate = useNavStore((s) => s.navigate);
  const queryClient = useQueryClient();
  const [chatTarget, setChatTarget] = useState<string | null>(null); // play_id
  const [chatText, setChatText] = useState("");

  const feed = useQuery({ queryKey: ["feed", roomId], queryFn: () => fetchFeed(roomId) });
  const messages = useQuery({
    queryKey: ["messages", roomId],
    queryFn: () => fetchMessages(roomId),
  });

  const playIds = (feed.data ?? []).flatMap((f) => (f.playId ? [f.playId] : []));
  const reactions = useQuery({
    queryKey: ["reactions", roomId, playIds.join(",")],
    queryFn: () => fetchReactions(playIds),
    enabled: playIds.length > 0,
  });

  // Realtime: 변경 감지 시 관련 쿼리 무효화
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["feed", roomId] });
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      queryClient.invalidateQueries({ queryKey: ["reactions", roomId] });
    };
    const channel = subscribeFeed(roomId, invalidate);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  const react = useMutation({
    mutationFn: ({ playId, emoji }: { playId: string; emoji: string }) =>
      toggleReaction(playId, emoji),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["reactions", roomId] }),
  });

  const chat = useMutation({
    mutationFn: ({ playId, body }: { playId: string; body: string }) =>
      sendMessage(roomId, playId, body),
    onSuccess: () => {
      setChatText("");
      setChatTarget(null);
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigate({ name: "rooms" })}>
          <Text style={styles.back}>‹ 방 목록</Text>
        </Pressable>
        <Text style={styles.title}>{roomName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={feed.data ?? []}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <NowPlayingCard
            item={item}
            reactions={item.playId ? (reactions.data?.[item.playId] ?? []) : []}
            onReact={(playId, emoji) => react.mutate({ playId, emoji })}
            onOpenChat={(playId) => setChatTarget(playId)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {feed.isLoading ? "불러오는 중..." : "아직 아무도 음악을 안 듣고 있어요"}
          </Text>
        }
        ListFooterComponent={
          <View style={styles.chatLog}>
            {(messages.data ?? []).map((m) => (
              <Text key={m.id} style={styles.chatLine}>
                <Text style={styles.chatNickname}>{m.nickname} </Text>
                {m.body}
              </Text>
            ))}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {chatTarget && (
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="한 줄 남기기"
            value={chatText}
            onChangeText={setChatText}
            maxLength={500}
            autoFocus
          />
          <Pressable
            style={styles.sendButton}
            disabled={!chatText.trim() || chat.isPending}
            onPress={() => chat.mutate({ playId: chatTarget, body: chatText.trim() })}
          >
            <Text style={styles.sendButtonText}>보내기</Text>
          </Pressable>
          <Pressable onPress={() => setChatTarget(null)}>
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 64 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  back: { fontSize: 14, opacity: 0.6 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  headerSpacer: { width: 50 },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { textAlign: "center", opacity: 0.5, marginTop: 40 },
  chatLog: { marginTop: 16, gap: 4 },
  chatLine: { fontSize: 13, lineHeight: 20 },
  chatNickname: { fontWeight: "600", opacity: 0.6 },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: "#191919",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sendButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  cancelText: { fontSize: 13, opacity: 0.5 },
});
