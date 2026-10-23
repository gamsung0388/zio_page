export async function insertAdmin(db, account) {
  return db
    .prepare(
      `INSERT INTO admin_users
    (username, display_name, password_hash, password_salt, password_iterations)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO NOTHING
    RETURNING id, username, display_name, created_at`,
    )
    .bind(
      account.username,
      account.display_name,
      account.password_hash,
      account.password_salt,
      account.password_iterations,
    )
    .first();
}

export async function listAdmins(db, page, pageSize) {
  const [rows, count] = await db.batch([
    db
      .prepare(
        "SELECT id, username, display_name, is_active, must_change_password, created_at, revision FROM admin_users ORDER BY id ASC LIMIT ? OFFSET ?",
      )
      .bind(pageSize, (page - 1) * pageSize),
    db.prepare("SELECT COUNT(*) AS total FROM admin_users"),
  ]);
  return {
    items: rows.results.map((row) => ({
      ...row,
      is_active: Boolean(row.is_active),
      must_change_password: Boolean(row.must_change_password),
    })),
    pagination: { page, page_size: pageSize, total: count.results[0].total },
  };
}
