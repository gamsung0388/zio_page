import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { prepareBackupRestore } from "../scripts/backup-schema.js";
const dump = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE songs(id INTEGER PRIMARY KEY, memo TEXT, updated_by INTEGER REFERENCES admin_users(id));
INSERT INTO songs VALUES(1,'메모; 줄바꿈\nCREATE TABLE 텍스트\n작은따옴표 '' 보존',1);
CREATE TABLE admin_users(id INTEGER PRIMARY KEY);
INSERT INTO admin_users VALUES(1);
CREATE TABLE operation_history(song_id INTEGER);
INSERT INTO operation_history VALUES(1);
CREATE TRIGGER log_song AFTER INSERT ON songs BEGIN INSERT INTO operation_history VALUES(NEW.id); END;`;
test("child-first D1 export restores exact quoted data and history without duplicate definitions or trigger effects", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    assert.throws(() => db.exec("BEGIN;" + dump + "COMMIT;"), /no such table/);
    db.exec("ROLLBACK");
    const prepared = prepareBackupRestore(dump);
    assert.equal(prepared.tableCount, 3);
    db.exec(prepared.schemaSql);
    db.exec("BEGIN;" + prepared.dataSql + "COMMIT;");
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM operation_history").get().n,
      1,
    );
    assert.equal(
      db.prepare("SELECT memo FROM songs").get().memo,
      "메모; 줄바꿈\nCREATE TABLE 텍스트\n작은따옴표 ' 보존",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.exec("INSERT INTO songs VALUES(2,'다음 곡',1)");
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM operation_history").get().n,
      2,
    );
  } finally {
    db.close();
  }
});
test("backup extraction preserves semicolons, SQL-looking strings, comments and quoted names while rejecting truncation", () => {
  const create =
    "/* ; 주석 */\nCREATE TABLE \"sample\" (value TEXT DEFAULT '테이블; 따옴표 '' 유지');";
  const insert =
    "\n-- CREATE TABLE fake(x);\nINSERT INTO sample VALUES('CREATE TABLE bogus(x);');";
  const result = prepareBackupRestore(create + insert);
  assert.equal(result.schemaSql, create);
  assert.equal(result.dataSql, insert);
  assert.equal(result.tableCount, 1);
  for (const value of [
    "",
    "CREATE TABLE x(value TEXT DEFAULT '끝나지 않음)",
    "/* 끝나지 않은 주석",
    "INSERT INTO sample VALUES(1);",
  ])
    assert.throws(() => prepareBackupRestore(value));
});
