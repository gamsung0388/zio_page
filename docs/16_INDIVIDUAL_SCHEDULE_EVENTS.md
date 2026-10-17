# 16. 개별 일정·시간 타입·기간 관리

작업일: 2026-10-17 (Asia/Seoul). 사용자의 시간 선택기, 기간 지정, 일정별 관리 요청을 반영합니다. 기존 하루 한 묶음의 주간 이미지 메모와 별도로 실제 개별 일정을 저장합니다.

## 사용 흐름

1. 관리자 **일정 관리 → 일정 달력**에서 날짜의 ＋ 또는 새 일정 등록을 선택합니다.
2. 제목/일정 구분/시작일/종료일을 입력하고 **시간 지정**, **종일**, **시간 미정** 중 선택합니다. 시간 지정은 네이티브 time 입력으로 시작/종료 HH:mm을 받습니다.
3. 같은 날짜에도 원하는 만큼 별개 일정을 등록하고 각 일정의 수정 버튼으로 개별 수정/삭제합니다. 기간 일정은 해당 날짜마다 표시하지만 하나의 id이므로 어디서 수정해도 해당 일정 전체가 바뀝니다.
4. PC는 달력, 모바일은 목록을 기본으로 하며 두 보기를 전환할 수 있습니다. 방송/합방/휴방/개인/기타 구분으로 필터링합니다. 모든 종류는 관리자 간 공유이고 공개되지 않습니다.
5. 다른 달에 일정을 저장하면 저장된 일정이 있는 달로 이동합니다. 현재 달과 기간이 겹치면 현재 달을 유지합니다.

## 날짜·시간 규칙

- 입력과 표시 기준은 한국 시간(KST, UTC+09:00)입니다. 브라우저의 시간대에 따라 입력한 시각을 바꾸지 않습니다. DB에는 UTC ISO8601의 시작과 끝을 저장합니다.
- 시간 지정은 종료 일시가 시작보다 늦어야 합니다. 23:00~다음 날 01:00은 종료 날짜를 다음 날로 선택합니다. 시작과 종료를 같게 입력해 0분 일정을 만들 수 없습니다.
- 시간 지정 구간은 시작 포함/종료 제외입니다. 1월 4일 23시~1월 5일 00시는 1월 4일에만 표시합니다.
- 종일/시간 미정은 종료 날짜까지 포함합니다. 저장 시 종료 날짜 다음 날 한국 자정으로 변환합니다. 1월 4~6일이면 3일 모두 표시합니다.
- 등록 가능 날짜는 2000-01-01~2099-12-31, 최대 366일입니다. 조회는 월간 42칸의 경계를 위해 1999~2100년을 허용하되 한 번에 최대 63일입니다.
- 제목 1~120자, 메모 0~2000자, 시각은 정확한 HH:mm입니다. 종일/시간 미정의 서버 입력 시각은 빈 문자열입니다. 브라우저 입력 도중 빈 날짜/시각은 초안에 보관하지만 최종 저장에서는 검증합니다.

## 데이터와 권한

새 테이블 admin_schedule_events에 id, title, description, kind, time_mode, starts_at, ends_at, revision, updated_by, created_at, updated_at을 저장합니다. 시작·종료 인덱스를 두고 겹치는 일정을 바인딩 SQL로 읽습니다. 조회는 starts_at < 조회 종료 다음 날, ends_at > 조회 시작으로 처리합니다.

기존 admin_schedule_weeks·songs·admin_users는 변경하지 않습니다. 실행 migration은 migrations/0005_admin_schedule_events.sql, database/migrations에는 참고 사본만 둡니다. 원격에는 실행 경로만 적용합니다.

개별 생성은 POST, 수정은 PUT+expected_revision, 삭제는 DELETE+expected_revision입니다. 수정/삭제는 id와 revision을 함께 비교하는 원자적 SQL이며 다른 관리자가 변경/삭제하면 409로 초안을 유지합니다. 시간의 겹침 자체는 허용합니다. 동시에 진행하는 서로 다른 일정을 지우지 않습니다.

모든 엔드포인트는 기존 관리자 인증·Origin·CSRF·강제 비밀번호 변경 뒤 실행합니다. 응답은 no-store이며 updated_by나 인증 정보를 노출하지 않습니다. 공개 일정 API는 없습니다.

## 기존 메모와 이미지

기존 날짜별 내용과 자유로운 시간 안내는 /admin/schedule/notes의 **주간 이미지 메모**로 보존했습니다. 기존 /api/admin/schedules 및 v1 백업 계약도 유지합니다. 기존 값을 임의로 파싱/이전하지 않습니다.

일정 등록의 **저장하고 이미지 만들기**는 시작일이 속한 주의 이미지 편집기를 열고 일정을 선택하게 합니다. 편집기에서 **등록된 일정 가져오기**로 직접 열 수도 있습니다. 개인/기타 일정은 기본으로 선택하지 않으며 관리자가 직접 포함할 수 있습니다.

- 하루 한 일정은 제목/시간을 각 칸에 채웁니다.
- 하루 여러 일정은 내용에 시간+제목을 여러 줄로 넣고 시간 칸에는 일정 N개를 표시합니다.
- 기간은 해당 주의 겹치는 날짜에만 넣습니다.
- 기본값은 선택 일정이 있는 날짜만 채워 기존 다른 날짜 메모를 보존합니다. 빈 날짜도 비우기는 별도 선택과 확인이 필요합니다.
- 글자 수가 길면 가져오기를 거부하며 데이터는 자르지 않습니다. 실제 이미지 칸 넘침은 기존 경고/자동 맞춤/다운로드 차단으로 처리합니다. 가져오기는 편집 상태만 바꾸고 주간 메모는 수동 저장해야 반영합니다.

## 초안·백업

일정 id 또는 신규 날짜별로 계정의 sessionStorage 초안을 분리합니다. 재로그인 후 동일 편집창으로 돌아와 수동 복구합니다. 새 일정/미완성 시각도 복구하며 저장 성공·로그아웃·확인 후 버리기에 정리합니다. 수정 초안은 원래 revision을 복구해 최신 변경을 덮어쓰지 않습니다. 입력창의 현재 입력 백업도 제공합니다.

개별 일정 백업은 {format:'zio-schedule-events',version:1,exported_at,events:[입력 필드]}입니다. 이번 달은 현재 필터의 해당 월과 겹치는 일정을, 전체는 200개씩 id 커서로 조회합니다. 최대 2,000개/10MB입니다. 과거 주간 메모 파일과 구분하고 모든 항목을 검증합니다. 파일에서 한 일정을 골라 새 입력으로 채우며 실제 저장 전에 확인합니다. 기존 일정을 자동으로 덮어쓰지 않고, 같은 항목을 반복 저장하면 별개 일정이 됩니다.

## 비용과 보존

기존 Workers/D1와 브라우저 이미지 출력을 이용합니다. 추가 라이브러리·유료 서비스·자동 폴링·예약 작업은 도입하지 않았습니다. 월/필터 변경과 저장 때만 다시 읽고 목록 조회는 두 개의 쿼리로 행과 건수를 가져옵니다. 한 화면의 최대 조회량은 2,000개입니다.

작업 전 소스·Git 상태는 .local/events-before-1792209235827/에 보관했습니다. 기존 사용자 SQL 조회문과 참고 ZIP은 그대로 두고 이번 커밋에서 제외합니다. 테스트는 Miniflare 및 .local/e2e/state만 사용하며 운영 계정·노래·일정을 테스트용으로 수정하지 않습니다.

## 검증과 배포

최종 테스트 실행 결과, 운영 DB 백업/migration/배포 버전과 읽기 전용 확인을 이 절에 이어 기록합니다. 화면은 1920×1080, 1440×900, 768×1024, 390×844, 360×800에서 확인하며 .local/event-review/screenshots/에 보관합니다. 실제 브라우저 시간대를 America/Los_Angeles로 두고 입력한 한국 시각이 그대로 저장/복원되는지도 검증합니다.

- 최종 단위·API 65개, 실제 브라우저 35개, 참고 UI 6개로 총 106개 통과. 기존 노래 CRUD·CSV·관리자 계정·주간 메모·PNG/JPEG 출력 회귀도 통과했습니다.
- 네이티브 시간 입력, 한 날짜 여러 일정, 자정 끝/종일 끝 날짜, 기간 조회, 개별 수정/삭제 버전 충돌, 초안 재로그인 복구, 백업 가져오기, 다른 달 저장 후 이동, 저장 후 이미지 선택을 검증했습니다.
- 5개 화면 크기의 달력·목록·입력창 총 15개 캡처를 만들고 대표 PC/모바일 화면을 직접 확인했습니다. 가로 넘침과 운영 앱의 브라우저 실행 오류가 없습니다.
- 최종 Worker/클라이언트 빌드 성공. 일반 로컬 DB에는 migration 0005만 추가했고 기존 데이터를 초기화하지 않았습니다. 참고 UI 6개는 통과했으며 기존 RouterLink 미등록 경고는 프로토타입에서만 관찰했습니다. 운영 앱에는 Vue Router가 등록되어 있습니다.

<details>
<summary>변경 파일 29개</summary>

```text
CODEX_PROMPT.md
README.md
database/migrations/0005_admin_schedule_events.sql
docs/03_API.md
docs/06_PHASE2_SCHEDULE.md
docs/12_ADMIN_SCHEDULE.md
docs/16_INDIVIDUAL_SCHEDULE_EVENTS.md
migrations/0005_admin_schedule_events.sql
server/repositories/schedule-events.js
server/routes/admin.js
server/routes/schedule-events.js
server/services/event-validation.js
shared/schedule/events.js
src/components/schedule/ScheduleEventDialog.vue
src/components/schedule/ScheduleNav.vue
src/pages/AdminSchedule.vue
src/pages/AdminScheduleImage.vue
src/pages/AdminScheduleNotes.vue
src/router/index.js
src/schedule/events-service.js
src/services/return-to.js
src/services/useEditorDraft.js
src/styles/schedule.css
tests/api.test.js
tests/e2e/events.spec.js
tests/e2e/prepare.js
tests/e2e/recovery.spec.js
tests/e2e/schedule.spec.js
tests/events.test.js
```

</details>
