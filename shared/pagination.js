export function pageCount(total, pageSize) {
  return Math.max(1, Math.ceil(total / pageSize));
}
export function queryPage(value, max = 10000) {
  return typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number(value) <= max
    ? Number(value)
    : 1;
}
