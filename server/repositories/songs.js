import { SORTS, SONG_FIELDS } from "../services/song-validation.js";
export const PUBLIC_COLUMNS =
  "id, title, artist, description, genre, language, proficiency, practice_status, balloon_cost, is_public, created_at, updated_at";
export const serialize = (row) =>
  row ? { ...row, is_public: row.is_public === 1 } : null;
const columns = (admin) => PUBLIC_COLUMNS + (admin ? ", memo" : "");
export async function listSongs(db, filters, admin = false) {
  const where = admin ? ["1=1"] : ["is_public=1"];
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
        `SELECT DISTINCT genre, language FROM songs WHERE ${admin ? "1=1" : "is_public=1"} AND (genre <> '' OR language <> '')`,
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
        `SELECT ${columns(admin)} FROM songs WHERE id=?${admin ? "" : " AND is_public=1"}`,
      )
      .bind(id)
      .first(),
  );
}
export async function createSong(db, song) {
  const row = await db
    .prepare(
      `INSERT INTO songs (${SONG_FIELDS.join(",")}) VALUES (${SONG_FIELDS.map(() => "?").join(",")}) RETURNING *`,
    )
    .bind(
      ...SONG_FIELDS.map((field) =>
        field === "is_public" ? Number(song[field]) : song[field],
      ),
    )
    .first();
  return serialize(row);
}
export async function updateSong(db, id, changes) {
  const fields = SONG_FIELDS.filter((field) => Object.hasOwn(changes, field));
  const row = await db
    .prepare(
      `UPDATE songs SET ${fields.map((field) => `${field}=?`).join(",")}, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? RETURNING *`,
    )
    .bind(
      ...fields.map((field) =>
        field === "is_public" ? Number(changes[field]) : changes[field],
      ),
      id,
    )
    .first();
  return serialize(row);
}
export async function deleteSong(db, id) {
  return db
    .prepare("DELETE FROM songs WHERE id=? RETURNING id")
    .bind(id)
    .first();
}
