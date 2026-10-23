import { ApiError } from "../utils/http.js";
import { revisionBody } from "./operation-validation.js";
export async function changeAdminStatus(db, id, body, actor) {
  const revision = revisionBody(body, ["is_active"]);
  if (typeof body.is_active !== "boolean")
    throw new ApiError(422, "ADMIN_STATUS", "사용 여부를 확인해주세요.");
  if (id === actor)
    throw new ApiError(
      422,
      "ADMIN_SELF",
      "내 계정의 사용 여부는 바꿀 수 없어요.",
    );
  const results = await db.batch([
    db
      .prepare(
        "UPDATE admin_users SET is_active=?,revision=revision+1,status_updated_by=? WHERE id=? AND revision=? AND is_active<>? AND EXISTS(SELECT 1 FROM admin_users a WHERE a.id=? AND a.is_active=1) AND (?=1 OR (SELECT COUNT(*) FROM admin_users WHERE is_active=1)>1) RETURNING id",
      )
      .bind(
        Number(body.is_active),
        actor,
        id,
        revision,
        Number(body.is_active),
        actor,
        Number(body.is_active),
      ),
    db
      .prepare(
        "DELETE FROM admin_sessions WHERE admin_user_id=? AND EXISTS(SELECT 1 FROM admin_users WHERE id=? AND revision=? AND status_updated_by=?)",
      )
      .bind(id, id, revision + 1, actor),
  ]);
  if (!results[0].results.length)
    throw new ApiError(
      409,
      "ADMIN_STATUS_CONFLICT",
      "계정이 변경됐거나 마지막 활성 관리자를 중지할 수 없어요. 최신 목록을 확인해주세요.",
    );
  return { ok: true, id, is_active: body.is_active };
}
export async function revokeAdminSessions(db, id, actor) {
  if (id === actor)
    throw new ApiError(
      422,
      "ADMIN_SELF",
      "내 계정은 로그아웃 메뉴를 이용해주세요.",
    );
  const target = await db
    .prepare("SELECT id FROM admin_users WHERE id=?")
    .bind(id)
    .first();
  if (!target)
    throw new ApiError(404, "NOT_FOUND", "관리자를 찾을 수 없습니다.");
  await db.batch([
    db
      .prepare(
        "DELETE FROM admin_sessions WHERE admin_user_id=? AND EXISTS(SELECT 1 FROM admin_users WHERE id=? AND is_active=1)",
      )
      .bind(id, actor),
    db
      .prepare(
        "INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) SELECT 'admin',id,'revoke',username,? FROM admin_users WHERE id=? AND EXISTS(SELECT 1 FROM admin_users WHERE id=? AND is_active=1)",
      )
      .bind(actor, id, actor),
  ]);
  return { ok: true, id };
}
