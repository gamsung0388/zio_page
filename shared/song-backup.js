import {
  SONG_FIELDS,
  SONG_TEXT_FIELDS,
  PRACTICE_OPTIONS,
} from "./song-rules.js";
import { validateAlbum } from "./album.js";
export const SONG_BACKUP_MAX_BYTES = 12 * 1024 * 1024;
export function readSongBackup(value) {
  if (
    !value ||
    Object.keys(value).some(
      (k) => !["format", "version", "exported_at", "songs"].includes(k),
    ) ||
    value.format !== "zio-songbook" ||
    value.version !== 1 ||
    typeof value.exported_at !== "string" ||
    !Number.isFinite(Date.parse(value.exported_at)) ||
    !Array.isArray(value.songs) ||
    value.songs.length > 10000
  )
    throw Error("ZIO HOME 노래 JSON 백업 파일을 선택해주세요.");
  return value.songs.map((song) => {
    if (
      !song ||
      Object.keys(song).some((k) => ![...SONG_FIELDS, "album"].includes(k)) ||
      SONG_FIELDS.some((k) => !Object.hasOwn(song, k))
    )
      throw Error("백업의 노래 항목이 올바르지 않아요.");
    for (const [key, { min, max }] of Object.entries(SONG_TEXT_FIELDS)) {
      if (
        typeof song[key] !== "string" ||
        Array.from(song[key].trim()).length < min ||
        Array.from(song[key]).length > max
      )
        throw Error("백업의 곡명·설명·메모 길이를 확인해주세요.");
    }
    if (
      !Number.isInteger(song.proficiency) ||
      song.proficiency < 1 ||
      song.proficiency > 5 ||
      !Number.isSafeInteger(song.balloon_cost) ||
      song.balloon_cost < 0 ||
      typeof song.is_public !== "boolean" ||
      !PRACTICE_OPTIONS.some((row) => row.value === song.practice_status)
    )
      throw Error("백업의 숙련도·풍·연습 상태를 확인해주세요.");
    return { ...song, album: validateAlbum(song.album ?? null) };
  });
}
