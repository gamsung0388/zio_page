export const ALBUM_LAB_PATH = "/admin/album-lab";
export function isAlbumLabOwner(user) {
  return user?.username === "admin" && !user.must_change_password;
}
