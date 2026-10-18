import { readDraft, writeDraft, removeDraft } from "./draft-storage.js";

export async function fileHash(file) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export function importTask(storage, owner, hash) {
  const scope = "csv-import:" + hash;
  const previous = readDraft(storage, owner, scope)?.value;
  const key =
    typeof previous?.key === "string" &&
    /^[A-Za-z0-9._-]{16,80}$/.test(previous.key)
      ? previous.key
      : crypto.randomUUID();
  return { key, persisted: writeDraft(storage, owner, scope, { key }), scope };
}
export function completeImportTask(storage, owner, task) {
  removeDraft(storage, owner, task.scope);
}
