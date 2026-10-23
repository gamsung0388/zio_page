import { shallowRef, watch } from "vue";
import { api, session } from "./api.js";
import { SONG_BACKUP_MAX_BYTES } from "../../shared/song-backup.js";
import { SONG_FIELDS } from "../../shared/song-rules.js";
export const stagedSongBackup = shallowRef(null);
watch(
  () => session.user?.id,
  () => {
    stagedSongBackup.value = null;
  },
);
export async function backupSongs() {
  const songs = [];
  let after = 0;
  while (true) {
    const data = await api(
      "/admin/songs/backup" + (after ? "?after=" + after : ""),
    );
    for (const song of data.items)
      songs.push(
        Object.fromEntries([
          ...SONG_FIELDS.map((field) => [field, song[field]]),
          ["album", song.album ?? null],
        ]),
      );
    if (songs.length > 10000)
      throw Error("10,000곡을 넘는 전체 백업은 운영 도구를 이용해주세요.");
    if (data.next_after === null) break;
    if (!Number.isSafeInteger(data.next_after) || data.next_after <= after)
      throw Error("백업 페이지를 확인할 수 없어요.");
    after = data.next_after;
  }
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: "zio-songbook",
          version: 1,
          exported_at: new Date().toISOString(),
          songs,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  if (blob.size > SONG_BACKUP_MAX_BYTES)
    throw Error("12MB를 넘는 백업은 운영 SQL 백업을 이용해주세요.");
  return blob;
}
