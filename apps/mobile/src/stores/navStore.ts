import { create } from "zustand";

/** MVP용 최소 네비게이션. 화면이 늘어나면 expo-router 도입 검토. */
export type Screen =
  | { name: "rooms" }
  | { name: "roomFeed"; roomId: string; roomName: string };

interface NavState {
  screen: Screen;
  navigate: (screen: Screen) => void;
}

export const useNavStore = create<NavState>((set) => ({
  screen: { name: "rooms" },
  navigate: (screen) => set({ screen }),
}));
