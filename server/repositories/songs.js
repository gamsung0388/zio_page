import { SORTS, SONG_FIELDS } from "../services/song-validation.js";
export const PUBLIC_COLUMNS =
  "id, title, artist, description, genre, language, proficiency, practice_status, balloon_cost, is_public, created_at, updated_at, album";
export function serialize(row) {
  if (!row) return null;
  const { album, deleted_at, updated_by, ...rest } = row;
  const value = album ? JSON.parse(album) : null;
  return {
    ...rest,
    is_public: row.is_public === 1,
    ...(value ? { album: value } : {}),
  };
}
const columns = (admin) => PUBLIC_COLUMNS + (admin ? ", memo, revision" : "");
export async function listSongs(db, filters, admin = false) {
  const where = admin
    ? ["deleted_at IS NULL"]
    : ["deleted_at IS NULL", "is_public=1"];
  const values = [];
  if (filters.q) {
    // instr avoids wildcard injection and D1's 50-byte LIKE pattern limit.
    where.push(
      "(instr(lower(title), lower(?)) > 0 OR instr(lower(artist), lower(?)) > 0)",
    );
    values.push(filters.q, filters.q);
  }
  for (const key of [
    "genre",
    "language",
    "proficiency",
    "practice_status",
    "is_public",
  ]) {
    if (filters[key] !== undefined) {
      where.push(`${key} = ?`);
      values.push(filters[key]);
    }
  }
  const condition = where.join(" AND ");
  const queries = [
    db
      .prepare(
        `SELECT ${columns(admin)} FROM songs WHERE ${condition} ORDER BY ${SORTS[filters.sort]} LIMIT ? OFFSET ?`,
      )
      .bind(
        ...values,
        filters.page_size,
        (filters.page - 1) * filters.page_size,
      ),
    db
      .prepare(`SELECT COUNT(*) AS total FROM songs WHERE ${condition}`)
      .bind(...values),
  ];
  if (filters.include_filters)
    queries.push(
      db.prepare(
        `SELECT DISTINCT genre, language FROM songs WHERE deleted_at IS NULL AND ${admin ? "1=1" : "is_public=1"} AND (genre <> '' OR language <> '')`,
      ),
    );
  const results = await db.batch(queries);
  const result = {
    items: results[0].results.map(serialize),
    pagination: {
      page: filters.page,
      page_size: filters.page_size,
      total: results[1].results[0].total,
    },
  };
  if (filters.include_filters)
    result.filters = {
      genres: [
        ...new Set(results[2].results.map((r) => r.genre).filter(Boolean)),
      ].sort(),
      languages: [
        ...new Set(results[2].results.map((r) => r.language).filter(Boolean)),
      ].sort(),
    };
  return result;
}
export async function getSong(db, id, admin = false) {
  return serialize(
    await db
      .prepare(
        `SELECT ${columns(admin)} FROM songs WHERE deleted_at IS NULL AND id=?${admin ? "" : " AND is_public=1"}`,
      )
      .bind(id)
      .first(),
  );
}
export async function createSong(db, song, actor = null) {
  const fields = [...SONG_FIELDS, "album", "updated_by"];
  const row = await db
    .prepare(
      `INSERT INTO songs (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")}) RETURNING *`,
    )
    .bind(
      ...fields.map((field) =>
        field === "updated_by"
          ? actor
          : field === "album"
            ? JSON.stringify(song.album ?? null)
            : field === "is_public"
              ? Number(song[field])
              : song[field],
      ),
    )
    .first();
  return serialize(row);
}
export async function updateSong(db, id, changes, revision, actor = null) {
  const fields = [...SONG_FIELDS, "album"].filter((field) =>
    Object.hasOwn(changes, field),
  );
  const row = await db
    .prepare(
      `UPDATE songs SET ${fields.map((field) => `${field}=?`).join(",")}, revision=revision+1, updated_by=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE deleted_at IS NULL AND id=? AND revision=? RETURNING *`,
    )
    .bind(
      ...fields.map((field) =>
        field === "album"
          ? JSON.stringify(changes[field])
          : field === "is_public"
            ? Number(changes[field])
            : changes[field],
      ),
      actor,
      id,
      revision,
    )
    .first();
  return serialize(row);
}
export async function deleteSong(db, id, revision, actor = null) {
  return db
    .prepare(
      "UPDATE songs SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revision=revision+1,updated_by=? WHERE id=? AND revision=? AND deleted_at IS NULL RETURNING id",
    )
    .bind(actor, id, revision)
    .first();
}
