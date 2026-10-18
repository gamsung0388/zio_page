import { sha256 } from "../utils/crypto.js";
import { ApiError } from "../utils/http.js";
import { validateSong, SONG_FIELDS } from "./song-validation.js";
export const CSV_MAX_BYTES = 1024 * 1024;
export const CSV_MAX_ROWS = 1000;
export const CSV_COLUMNS = SONG_FIELDS;

export function parseCSV(source) {
  const text = source.replace(/^\uFEFF/, "");
  const rows = [];
  let fields = [],
    field = "",
    quoted = false,
    closed = false,
    line = 1,
    startLine = 1;
  const finishField = () => {
    fields.push(field);
    field = "";
    closed = false;
  };
  const finishRow = () => {
    finishField();
    if (fields.some((value) => value !== ""))
      rows.push({ values: fields, line: startLine });
    fields = [];
    if (rows.length > CSV_MAX_ROWS + 1)
      throw new ApiError(
        422,
        "CSV_ROWS",
        `CSV는 최대 ${CSV_MAX_ROWS}곡까지 등록할 수 있습니다.`,
      );
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        field += char;
        if (char === "\n") line++;
      }
    } else if (char === ",") finishField();
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
      line++;
      startLine = line;
    } else if (char === '"' && field === "" && !closed) quoted = true;
    else {
      if (closed || char === '"')
        throw new ApiError(
          422,
          "CSV_SYNTAX",
          `${line}행: 큰따옴표 형식이 올바르지 않습니다.`,
        );
      field += char;
    }
  }
  if (quoted)
    throw new ApiError(
      422,
      "CSV_SYNTAX",
      `${startLine}행: 닫히지 않은 큰따옴표가 있습니다.`,
    );
  if (field || fields.length || closed) finishRow();
  return rows;
}

function csvNumber(value, fallback) {
  if (value === "") return fallback;
  return /^\d+$/.test(value) ? Number(value) : NaN;
}
function csvBoolean(value) {
  if (value === "" || value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}
export async function inspectCSV(db, text) {
  const parsed = parseCSV(text);
  const header = parsed.shift()?.values.map((value) => value.trim());
  if (
    !header ||
    header.length !== CSV_COLUMNS.length ||
    new Set(header).size !== header.length ||
    header.some((name) => !CSV_COLUMNS.includes(name))
  ) {
    throw new ApiError(
      422,
      "CSV_HEADER",
      `헤더는 다음 10개 컬럼을 포함해야 합니다: ${CSV_COLUMNS.join(",")}`,
    );
  }
  if (!parsed.length)
    throw new ApiError(422, "CSV_EMPTY", "등록할 노래가 없습니다.");
  const errors = [],
    rows = [],
    warnings = [];
  const seen = new Set();
  let matchSnapshot = [];
  for (const record of parsed) {
    if (record.values.length !== header.length) {
      errors.push({
        row: record.line,
        field: "",
        message: "컬럼 수가 헤더와 다릅니다.",
      });
      continue;
    }
    const song = Object.fromEntries(
      header.map((key, i) => [key, record.values[i]]),
    );
    song.proficiency = csvNumber(song.proficiency, 1);
    song.balloon_cost = csvNumber(song.balloon_cost, 0);
    song.is_public = csvBoolean(song.is_public);
    if (!song.practice_status) song.practice_status = "not_started";
    try {
      const validated = validateSong(song);
      const key = JSON.stringify([
        validated.title.toLowerCase(),
        validated.artist.toLowerCase(),
      ]);
      if (seen.has(key))
        warnings.push({
          row: record.line,
          message:
            "파일 안에 같은 제목·가수의 곡이 있습니다. 별도 곡으로 추가됩니다.",
        });
      seen.add(key);
      rows.push({ row: record.line, song: validated });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      errors.push(
        ...error.details.map((detail) => ({ row: record.line, ...detail })),
      );
    }
  }
  if (rows.length) {
    const existing = await db
      .prepare(
        `SELECT DISTINCT s.id, s.title, s.artist FROM songs s
      JOIN json_each(?) j ON s.title = json_extract(j.value,'$.title') COLLATE NOCASE
      AND s.artist = json_extract(j.value,'$.artist') COLLATE NOCASE ORDER BY s.id`,
      )
      .bind(
        JSON.stringify(
          rows.map((r) => ({ title: r.song.title, artist: r.song.artist })),
        ),
      )
      .all();
    matchSnapshot = existing.results.map((song) => [
      song.id,
      song.title,
      song.artist,
    ]);
    const keys = new Set(
      existing.results.map((s) =>
        JSON.stringify([s.title.toLowerCase(), s.artist.toLowerCase()]),
      ),
    );
    for (const row of rows)
      if (
        keys.has(
          JSON.stringify([
            row.song.title.toLowerCase(),
            row.song.artist.toLowerCase(),
          ]),
        )
      ) {
        warnings.push({
          row: row.row,
          message:
            "기존 곡과 제목·가수가 같습니다. 기존 데이터를 덮어쓰지 않고 추가합니다.",
        });
      }
  }
  const preview = {
    total: parsed.length,
    rows,
    errors,
    warnings,
    can_import: errors.length === 0,
    preview_token: await sha256(
      JSON.stringify([await sha256(text), matchSnapshot]),
    ),
  };
  return {
    preview,
    matchSnapshot,
    matches: rows.map((row) => ({
      title: row.song.title,
      artist: row.song.artist,
    })),
  };
}

export async function previewCSV(db, text) {
  return (await inspectCSV(db, text)).preview;
}

export function escapeCSV(value) {
  let text = String(value ?? "");
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function stringifyCSV(songs) {
  return (
    "\uFEFF" +
    CSV_COLUMNS.join(",") +
    "\r\n" +
    songs
      .map((song) =>
        CSV_COLUMNS.map((key) =>
          escapeCSV(key === "is_public" ? Boolean(song[key]) : song[key]),
        ).join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}
