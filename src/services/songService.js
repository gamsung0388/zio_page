import { mockSongs } from "../data/mockSongs";

// UI 단계의 교체 가능한 데이터 경계입니다.
// 이후 Worker /api/songs에 연결할 때 이 파일의 함수만 변경하세요.
// 현재 데이터는 메모리에만 있으며 새로고침하면 초기화됩니다.
let memorySongs = structuredClone(mockSongs);
const clone = (value) => structuredClone(value);

export async function listSongs() {
  return clone(memorySongs);
}

export async function getSong(id) {
  return clone(memorySongs.find((song) => song.id === id) ?? null);
}

export async function createSong(payload) {
  const today = new Date().toISOString().slice(0, 10);
  const song = {
    ...clone(payload),
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: today,
    updatedAt: today,
  };
  memorySongs.unshift(song);
  return clone(song);
}

export async function updateSong(id, payload) {
  const index = memorySongs.findIndex((song) => song.id === id);
  if (index < 0) throw new Error("곡을 찾을 수 없습니다.");
  memorySongs[index] = {
    ...memorySongs[index],
    ...clone(payload),
    id,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  return clone(memorySongs[index]);
}

export async function deleteSong(id) {
  memorySongs = memorySongs.filter((song) => song.id !== id);
}
