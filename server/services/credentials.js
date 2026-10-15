export const RESET_PASSWORD = "qwer1234!@#$";

export function newPasswordErrors(password, confirmation) {
  const errors = [];
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  ) {
    errors.push({
      field: "password",
      message: "새 비밀번호는 12~256자로 입력해주세요.",
    });
  } else if (password === RESET_PASSWORD) {
    errors.push({
      field: "password",
      message: "초기화용 비밀번호와 다른 비밀번호를 사용해주세요.",
    });
  }
  if (typeof confirmation !== "string" || confirmation !== password) {
    errors.push({
      field: "password_confirmation",
      message: "비밀번호 확인이 일치하지 않습니다.",
    });
  }
  return errors;
}
