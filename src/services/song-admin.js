import { api } from "./api.js";
import { toSongInput, toSongView } from "./song-adapter.js";

const path = (id) => "/admin/songs/" + encodeURIComponent(id);
export async function getAdminSong(id, options = {}) {
  return toSongView(await api(path(id), options), { admin: true });
}
export function updateAdminSong(id, revision, changes) {
  return api(path(id), {
    method: "PATCH",
    body: { ...changes, expected_revision: revision },
  });
}
export function saveAdminSong(id, draft) {
  const body = toSongInput(draft, { admin: true });
  return id
    ? updateAdminSong(id, draft.sourceRevision, body)
    : api("/admin/songs", { method: "POST", body });
}
export function removeAdminSong(song) {
  return api(path(song.id), {
    method: "DELETE",
    body: { expected_revision: song.revision },
  });
}
