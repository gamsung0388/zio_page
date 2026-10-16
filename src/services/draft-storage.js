const PREFIX = "zio:draft:v1:";
const MAX_AGE = 24 * 60 * 60 * 1000;
const MAX_BYTES = 100000;
export function draftKey(owner, scope) {
  return (
    PREFIX + encodeURIComponent(String(owner)) + ":" + encodeURIComponent(scope)
  );
}
export function readDraft(storage, owner, scope, now = Date.now()) {
  if (!owner || !scope) return null;
  const key = draftKey(owner, scope);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    if (raw.length > MAX_BYTES) throw new Error("size");
    const entry = JSON.parse(raw);
    if (
      entry.version !== 1 ||
      entry.owner !== String(owner) ||
      entry.scope !== scope ||
      !Number.isFinite(entry.updatedAt) ||
      now - entry.updatedAt > MAX_AGE ||
      entry.updatedAt > now + 60000
    )
      throw new Error("invalid");
    return entry;
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
}
export function writeDraft(storage, owner, scope, value, now = Date.now()) {
  if (!owner || !scope) return false;
  try {
    const raw = JSON.stringify({
      version: 1,
      owner: String(owner),
      scope,
      updatedAt: now,
      value,
    });
    if (raw.length > MAX_BYTES) return false;
    storage.setItem(draftKey(owner, scope), raw);
    return true;
  } catch {
    return false;
  }
}
export function removeDraft(storage, owner, scope) {
  try {
    storage.removeItem(draftKey(owner, scope));
  } catch {}
}
export function clearUserDrafts(storage, owner) {
  if (!owner) return;
  try {
    const prefix = PREFIX + encodeURIComponent(String(owner)) + ":";
    for (const key of Object.keys(storage))
      if (key.startsWith(prefix)) storage.removeItem(key);
  } catch {}
}
