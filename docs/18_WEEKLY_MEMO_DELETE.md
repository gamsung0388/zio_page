# 18. 저장된 주간 이미지 메모 삭제

작업일: 2026-10-17 (Asia/Seoul). 사용자가 메뉴 제거가 아닌 **저장된 주간 메모를 삭제하는 기능**을 선택했습니다. 일정 달력의 개별 일정과 주간 이미지 메모는 별도 저장 대상입니다.

## 사용 방법

1. 관리자 **주간 이미지 메모** 화면 아래 **저장된 주간 메모**에서 주별 삭제를 누릅니다. 현재 달에 걸치는 저장 주만 표시합니다.
2. 또는 **스케줄 이미지**에서 주를 선택하고 **이 주 저장 메모 삭제**를 누릅니다. 저장된 메모가 없는 주는 삭제 버튼을 비활성화합니다.
3. 확인 창에서 월요일~일요일의 날짜·시간·내용을 확인합니다. **삭제 전 JSON 백업**으로 선택한 주를 내려받을 수 있습니다.
4. **이 주 메모 삭제**를 누르면 해당 주의 7일치 내용·시간과 이미지 꾸미기 설정을 지웁니다. 이미지 편집기에서 삭제하는 경우 현재 미저장 입력도 비워진다는 안내를 먼저 표시합니다.
5. 다른 주의 메모, 노래, 관리자, 일정 달력에 등록한 개별 일정은 유지됩니다. 취소하면 저장 내용과 현재 입력을 바꾸지 않습니다.

삭제 후 백업에서 가져오기는 기존과 같이 화면에만 채우며 직접 저장해야 복구됩니다. 자동 실행되는 전체 삭제 기능은 추가하지 않았습니다.

## API와 동시 수정

- `DELETE /api/admin/schedules/:week_start`, JSON `{ "expected_revision": 1 }`.
- 기존 관리자 세션, 강제 비밀번호 변경, 동일 출처, CSRF를 모두 검사한 뒤 실행합니다. 월요일 날짜와 양의 안전 정수 버전만 허용하며 다른 입력 필드는 거부합니다.
- 성공은 200과 기본 주간 문서, 증가한 revision, `is_saved:false`, `updated_at:null`을 반환합니다. 변경·이미 삭제·저장본 없음은 409, 잘못된 필드는 422입니다. 공통 JSON 객체 검증과 날짜 검증 오류는 400입니다.
- 주간 GET/PUT 응답에 `is_saved`를 추가했습니다. 새 미저장 주는 revision 0입니다. 삭제한 주는 `is_saved:false`이지만 버전을 유지하므로 revision은 0보다 큽니다. 편집기는 revision이 0인지와 별개로 저장 여부를 표시합니다.
- 삭제 확인 중 다른 관리자가 수정하면 서버가 삭제를 거부하고 최신 내용을 보존합니다. 확인 창을 닫고 저장 내용을 다시 불러와야 합니다.

## 내용 삭제와 버전 보존

행을 물리 삭제한 뒤 같은 주를 revision 1로 다시 만들면, 예전 편집창의 revision 1 요청이 새 내용을 덮거나 지울 수 있습니다. 이를 막기 위해 기존 `admin_schedule_weeks`의 payload를 내부 표식 `{ "_deleted": true }` 하나로 교체하고 revision을 증가시키는 원자적 UPDATE를 사용합니다.

기존 7일치 원문과 이미지 설정은 payload에서 제거되며 원문을 숨겨 보관하지 않습니다. 날짜·버전·수정자·수정 시각만 내부 행에 남습니다. GET은 기본값만 반환하고 목록과 JSON 백업은 삭제 표식을 제외합니다. 새 저장은 삭제 이후의 버전을 확인한 뒤 수행합니다. 클라이언트가 `_deleted` 표식을 직접 저장하는 요청은 기존 입력 검증에서 거부합니다.

추가 DB 스키마·migration·외부 서비스는 없습니다. 기존 주간 테이블과 인덱스를 사용하며 조회·백업의 범위와 페이지 상한을 유지합니다. 삭제 API는 선택한 한 주만 처리합니다.

## 검증과 보존

- 단위·API 검증: 삭제 권한·CSRF·출처·강제 변경, 잘못된 입력, 7일 내용/스타일 제거, 다른 주/개별 일정 보존, 목록/백업 제외, 동시 삭제와 삭제 후 재생성 충돌을 추가했습니다.
- 실제 브라우저: 주별 목록, 7일 확인, 백업·취소, 삭제 후 새로고침, 미저장 입력 정리, 같은 주 재저장, 오래된 확인 창 차단, PC/모바일 확인 창을 검증합니다. 기존 주간 편집·세션 복구·이미지 출력도 함께 확인합니다.
- 기존 사용자 변경인 `database/migrations/0001_initial.sql`과 참고 ZIP은 보존하고 커밋에서 제외합니다. 작업 전 파일/상태는 `.local/week-delete-before-1792212102922/`에 보관했습니다.
- 운영 계정이나 메모를 실제로 삭제해 시험하지 않습니다. 삭제·저장 검증은 격리된 테스트 D1에서만 수행합니다.

## 변경 파일

`README.md`, `docs/03_API.md`, `docs/18_WEEKLY_MEMO_DELETE.md`, `server/repositories/schedules.js`, `server/routes/schedules.js`, `server/services/schedule-validation.js`, `src/components/schedule/ScheduleWeekDelete.vue`, `src/pages/AdminScheduleImage.vue`, `src/pages/AdminScheduleNotes.vue`, `src/schedule/useScheduleEditor.js`, `src/styles/schedule.css`, `tests/api.test.js`, `tests/e2e/week-delete.spec.js`.

최종 실행 결과와 운영 확인은 아래에 기록합니다.

최종 검증: `npm test` 72개, 주간 삭제·주간 이미지·초안 복구 브라우저 19개로 총 **91개 통과**했습니다. `npm run build`도 성공했습니다. 기존 5개 반응형 크기와 360/390/1440px 삭제 확인 창을 검증했습니다. 증거는 `.local/week-delete-review/checks.json`, `.local/week-delete-review/e2e-results/`, `.local/week-delete-review/390-confirm.png`에 보관합니다.

## 운영 반영 완료

- 배포 소스 `ba68102`, Worker `551d872a-2f0c-4797-aecb-39e22f8c4858`. GitHub `codex/phase1`에 반영했습니다.
- 확인 시각 2026-10-17T04:46:50.640Z (한국 시간 2026-10-17 13:46). 운영 HTML/자산 59개가 빌드와 일치하며 DB 상태 정상입니다. 익명 관리자 조회 5개와 새 DELETE 요청은 모두 401로 차단됐습니다.
- 운영 자산을 로드한 QA 브라우저에서 1440/390/360px의 주간 삭제 확인 창, 7일 미리보기, 취소와 버튼 접근을 확인했습니다. 기존 일정 가져오기와 PNG 1672×941 출력도 정상입니다. 가로 넘침·실행 오류·CSP 위반이 없습니다.
- QA 브라우저의 관리자 GET만 검증 자료로 대체했고 쓰기 요청은 차단했습니다. 실제 운영 계정으로 로그인하거나 저장 메모를 삭제하지 않았습니다. 인증 후 삭제·충돌·복구는 격리된 테스트 D1에서 검증했습니다.
- DB migration이나 운영 데이터 정리는 수행하지 않았습니다. 운영 메모의 실제 삭제 0건입니다. 증거는 `.local/week-delete-review/production/verification.json`과 `production/screenshots/*-week-delete.png`에 보관합니다. 화면의 내용은 검증 예시입니다.
