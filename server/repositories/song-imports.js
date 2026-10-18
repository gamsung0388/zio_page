import { SONG_FIELDS } from "../../shared/song-rules.js";

const matchingSnapshot = `SELECT COALESCE(json_group_array(json_array(id,title,artist)), '[]') FROM (
  SELECT DISTINCT s.id, s.title, s.artist FROM songs s JOIN json_each(?) j
  ON s.title = json_extract(j.value, '$.title') COLLATE NOCASE
  AND s.artist = json_extract(j.value, '$.artist') COLLATE NOCASE ORDER BY s.id
)`;

export function findImportJob(db, owner, key) {
  return db
    .prepare(
      "SELECT body_hash, result_json FROM song_import_jobs WHERE admin_user_id=? AND request_key=?",
    )
    .bind(owner, key)
    .first();
}

export async function commitSongImport(
  db,
  { owner, key, bodyHash, claim, preview, matches, matchSnapshot },
) {
  const result = { imported: preview.rows.length, warnings: preview.warnings };
  const statements = [
    db
      .prepare(
        `INSERT INTO song_import_jobs (admin_user_id, request_key, body_hash, claim_token, result_json)
    SELECT ?,?,?,?,? WHERE (${matchingSnapshot}) = ?`,
      )
      .bind(
        owner,
        key,
        bodyHash,
        claim,
        JSON.stringify(result),
        JSON.stringify(matches),
        JSON.stringify(matchSnapshot),
      ),
  ];
  for (let offset = 0; offset < preview.rows.length; offset += 100) {
    const songs = preview.rows
      .slice(offset, offset + 100)
      .map((row) => ({ ...row.song, is_public: Number(row.song.is_public) }));
    statements.push(
      db
        .prepare(
          `INSERT INTO songs (${SONG_FIELDS.join(",")})
      SELECT ${SONG_FIELDS.map((field) => `json_extract(value, '$.${field}')`).join(",")} FROM json_each(?)
      WHERE EXISTS (SELECT 1 FROM song_import_jobs WHERE admin_user_id=? AND request_key=? AND claim_token=?)`,
        )
        .bind(JSON.stringify(songs), owner, key, claim),
    );
  }
  // The receipt, duplicate snapshot check and all row chunks commit atomically.
  // A per-attempt claim prevents an older receipt from enabling a racing insert.
  const committed = await db.batch(statements);
  return committed[0].meta.changes ? result : null;
}
