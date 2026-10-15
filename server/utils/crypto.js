export const PASSWORD_ITERATIONS = 100000;
const encoder = new TextEncoder();
export const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));
export const sha256 = async (value) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
export function timingSafeEqual(a, b) {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function hashPassword(
  password,
  salt,
  iterations = PASSWORD_ITERATIONS,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: encoder.encode(salt),
        iterations,
      },
      key,
      256,
    ),
  );
}
