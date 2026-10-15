export const findUser = (db, username) =>
  db
    .prepare("SELECT * FROM admin_users WHERE username=? AND is_active=1")
    .bind(username)
    .first();
export async function reserveLoginAttempt(db, keyHash, now) {
  return db
    .prepare(
      `INSERT INTO login_limits(key_hash, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
    attempts=CASE WHEN login_limits.expires_at <= ? THEN 1 ELSE login_limits.attempts+1 END,
    expires_at=CASE WHEN login_limits.expires_at <= ? THEN excluded.expires_at ELSE login_limits.expires_at END
    RETURNING attempts, expires_at`,
    )
    .bind(keyHash, now + 900, now, now)
    .first();
}
export async function createSession(db, userId, tokenHash, expiresAt) {
  // Opportunistic bounded cleanup; no scheduler needed.
  await db.batch([
    db.prepare(
      "DELETE FROM admin_sessions WHERE id IN (SELECT id FROM admin_sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now') LIMIT 100)",
    ),
    db
      .prepare(
        "DELETE FROM login_limits WHERE key_hash IN (SELECT key_hash FROM login_limits WHERE expires_at <= ? LIMIT 100)",
      )
      .bind(Math.floor(Date.now() / 1000)),
    db
      .prepare(
        "INSERT INTO admin_sessions(admin_user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      )
      .bind(userId, tokenHash, expiresAt),
  ]);
}
export const getSession = (db, tokenHash) =>
  db
    .prepare(
      `SELECT u.id, u.display_name, u.username, u.must_change_password, s.expires_at
  FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_user_id
  WHERE s.token_hash=? AND s.expires_at > ? AND u.is_active=1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first();
export const deleteSession = (db, tokenHash) =>
  db
    .prepare("DELETE FROM admin_sessions WHERE token_hash=?")
    .bind(tokenHash)
    .run();
