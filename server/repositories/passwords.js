export const findAdminById = (db, id) =>
  db.prepare("SELECT * FROM admin_users WHERE id=?").bind(id).first();

export async function resetAdminPassword(db, id, hash, salt, iterations) {
  const results = await db.batch([
    db
      .prepare(
        "UPDATE admin_users SET password_hash=?, password_salt=?, password_iterations=?, must_change_password=1 WHERE id=?",
      )
      .bind(hash, salt, iterations, id),
    db.prepare("DELETE FROM admin_sessions WHERE admin_user_id=?").bind(id),
  ]);
  return results[0].meta.changes > 0;
}

export async function changeAdminPassword(
  db,
  id,
  previousHash,
  hash,
  salt,
  iterations,
) {
  const results = await db.batch([
    db
      .prepare(
        "UPDATE admin_users SET password_hash=?, password_salt=?, password_iterations=?, must_change_password=0 WHERE id=? AND password_hash=?",
      )
      .bind(hash, salt, iterations, id, previousHash),
    db
      .prepare(
        "DELETE FROM admin_sessions WHERE admin_user_id=? AND EXISTS(SELECT 1 FROM admin_users WHERE id=? AND password_hash=?)",
      )
      .bind(id, id, hash),
  ]);
  return results[0].meta.changes > 0;
}
