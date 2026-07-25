import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createRoom, fetchMyRooms, joinRoomByCode } from "../api/rooms";
import { DetectionBanner } from "../components/DetectionBanner";
import { signOut } from "../lib/auth";
import { fetchSpotifyConnected, startSpotifyConnect } from "../lib/spotifyConnect";
import { useNavStore } from "../stores/navStore";

export function RoomsScreen() {
  const navigate = useNavStore((s) => s.navigate);
  const queryClient = useQueryClient();
  const [newRoomName, setNewRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rooms = useQuery({ queryKey: ["rooms"], queryFn: fetchMyRooms });
  const spotify = useQuery({ queryKey: ["spotifyStatus"], queryFn: fetchSpotifyConnected });

  const create = useMutation({
    mutationFn: createRoom,
    onSuccess: (room) => {
      setNewRoomName("");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      navigate({ name: "roomFeed", roomId: room.id, roomName: room.name });
    },
    onError: (e) => setError(e.message),
  });

  const join = useMutation({
    mutationFn: joinRoomByCode,
    onSuccess: (result) => {
      setJoinCode("");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      navigate({ name: "roomFeed", roomId: result.room_id, roomName: result.name });
    },
    onError: () => setError("방을 찾을 수 없습니다. 코드를 확인해주세요."),
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>내 방</Text>
        <Pressable onPress={() => void signOut()}>
          <Text style={styles.signOut}>로그아웃</Text>
        </Pressable>
      </View>

      <DetectionBanner />

      {spotify.data === false && (
        <Pressable
          style={styles.spotifyBanner}
          onPress={() => startSpotifyConnect().catch((e) => setError(e.message))}
        >
          <Text style={styles.spotifyBannerText}>
            🎧 Spotify 연동하고 내가 듣는 곡 공유하기
          </Text>
        </Pressable>
      )}
      {spotify.data === true && (
        <Text style={styles.spotifyConnected}>🎧 Spotify 연동됨 — 재생하면 자동으로 공유돼요</Text>
      )}

      <FlatList
        data={rooms.data ?? []}
        keyExtractor={(room) => room.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.roomCard}
            onPress={() => navigate({ name: "roomFeed", roomId: item.id, roomName: item.name })}
          >
            <Text style={styles.roomName}>{item.name}</Text>
            <Text style={styles.roomCode}>코드 {item.code}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {rooms.isLoading ? "불러오는 중..." : "아직 방이 없어요. 만들거나 코드로 들어가보세요."}
          </Text>
        }
      />

      <View style={styles.form}>
        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="새 방 이름"
            value={newRoomName}
            onChangeText={setNewRoomName}
          />
          <Pressable
            style={styles.button}
            disabled={!newRoomName.trim() || create.isPending}
            onPress={() => create.mutate(newRoomName.trim())}
          >
            <Text style={styles.buttonText}>만들기</Text>
          </Pressable>
        </View>
        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="방 코드 (6자리)"
            autoCapitalize="characters"
            maxLength={6}
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <Pressable
            style={styles.button}
            disabled={joinCode.trim().length !== 6 || join.isPending}
            onPress={() => join.mutate(joinCode)}
          >
            <Text style={styles.buttonText}>입장</Text>
          </Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 64, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  signOut: { fontSize: 13, opacity: 0.5 },
  spotifyBanner: {
    backgroundColor: "#1DB954",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  spotifyBannerText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  spotifyConnected: { fontSize: 12, opacity: 0.5, marginBottom: 12, textAlign: "center" },
  roomCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
    marginBottom: 8,
  },
  roomName: { fontSize: 16, fontWeight: "600" },
  roomCode: { fontSize: 12, opacity: 0.5, marginTop: 4 },
  empty: { textAlign: "center", opacity: 0.5, marginTop: 40 },
  form: { paddingVertical: 16, gap: 8 },
  formRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: "#191919",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#d33", fontSize: 13 },
});
