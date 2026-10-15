import password from "@inquirer/password";

export function validatePasswordLength(value) {
  if (value.length < 8)
    return `비밀번호는 8자 이상이어야 합니다. 현재 ${value.length}자입니다.`;
  if (value.length > 256) return "비밀번호는 256자 이하여야 합니다.";
  return true;
}
export function newPasswordOptions() {
  return {
    message: "비밀번호 (8~256자)",
    mask: "*",
    toggleMask: false,
    validate: validatePasswordLength,
  };
}
export function confirmationOptions(expected) {
  return {
    message: "비밀번호 확인",
    mask: "*",
    toggleMask: false,
    validate: (value) =>
      value === expected ||
      "두 비밀번호가 다릅니다. 확인 값을 지우고 다시 입력해주세요.",
  };
}
export async function promptNewPassword() {
  const value = await password(newPasswordOptions());
  await password(confirmationOptions(value));
  return value;
}
