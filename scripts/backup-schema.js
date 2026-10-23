// Separate CREATE TABLE from a D1 dump while keeping all literals/comments intact.
// SQLite trigger bodies cannot contain CREATE TABLE; retain their SQL untouched.
export function prepareBackupRestore(sql) {
  if (typeof sql !== "string" || !sql.trim())
    throw Error("SQL 백업이 비어 있습니다.");
  const tables = [],
    rest = [];
  let start = 0,
    quote = null,
    comment = null;
  function append(end) {
    const part = sql.slice(start, end);
    start = end;
    const code = part.replace(
      /^(?:\s+|--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)+/,
      "",
    );
    (/^CREATE\s+TABLE\b/i.test(code) ? tables : rest).push(part);
  }
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i],
      next = sql[i + 1];
    if (comment === "line") {
      if (char === "\n") comment = null;
      continue;
    }
    if (comment === "block") {
      if (char === "*" && next === "/") {
        comment = null;
        i++;
      }
      continue;
    }
    if (quote) {
      const end = quote === "[" ? "]" : quote;
      if (char === end) {
        if (next === end) i++;
        else quote = null;
      }
      continue;
    }
    if (char === "-" && next === "-") {
      comment = "line";
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      comment = "block";
      i++;
      continue;
    }
    if (["'", '"', "`", "["].includes(char)) {
      quote = char;
      continue;
    }
    if (char === ";") append(i + 1);
  }
  if (quote || comment === "block")
    throw Error("SQL 백업의 문자열 또는 주석이 끝나지 않았습니다.");
  if (start < sql.length) append(sql.length);
  if (!tables.length) throw Error("백업의 테이블 구조를 찾을 수 없습니다.");
  return {
    schemaSql: tables.join(""),
    dataSql: rest.join(""),
    tableCount: tables.length,
  };
}
