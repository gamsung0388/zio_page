# 21. 우선순위 개선과 공통 코드 정리

작업일: 2026-10-17 (Asia/Seoul). 기반 커밋 `463b2a2`. [배포 후 분석](20_POST_GUIDE_REVIEW.md) 중 먼저 안내한 1~3순위인 노래 동시 수정 보호, 일정 조회 페이지 처리, 달력 계산을 구현합니다. 함께 쓰는 기능은 공통 모듈에서, 노래·일정의 규칙은 각 기능 모듈에서 관리합니다.

## 노래 변경 보호

`0006_song_revisions.sql`은 기존 노래에 기본값 1인 정수 `revision`을 추가합니다. 노래 내용·계정·일정은 변경하지 않습니다. 수정은 `WHERE id=? AND revision=?` 조건과 버전 증가를 하나의 SQL로 실행하고, 삭제도 같은 버전을 확인합니다. 수정·공개 전환·삭제 모두 `expected_revision`이 필요합니다.

버전이 맞지 않거나 이미 삭제된 노래의 수정·삭제는 `409 SONG_CONFLICT`, 버전 누락·잘못된 값은 `422 SONG_REVISION`입니다. 단건 조회에서 없는 곡은 기존처럼 404입니다. 모든 요청에 기존 세션·비밀번호 변경 상태·Origin·CSRF 검사를 유지합니다. 관리자 GET만 revision을 포함하며 공개 GET와 CSV 10개 열은 기존 계약을 유지합니다. CSV 가져오기는 계속 추가 전용이고 새 곡의 버전은 기본값 1입니다.

편집 화면은 충돌 시 입력과 초안을 유지합니다. **저장된 내용과 비교**를 누르면 인증된 GET으로 최신 곡을 읽고 항목별로 저장된 내용·내 입력을 비교합니다. 원래 기준을 아는 경우 한쪽에서만 바뀐 항목은 그 변경을 기본 선택하며, 양쪽에서 바뀐 항목은 직접 선택해야 합니다. 초안을 복구해 원래 기준을 확인할 수 없는 경우에는 서로 다른 모든 항목을 직접 선택합니다. 비교 적용은 편집 화면만 변경하고, 다시 **수정하기**를 눌러야 서버에 저장합니다. 그 사이 또 변경되면 같은 버전 검사로 다시 보호합니다.

복구 초안은 작성 당시 revision을 유지합니다. 버전이 없는 예전 초안은 원래 저장 시각이 같은 경우만 현재 버전을 연결하며, 다르면 비교를 먼저 요구합니다. 삭제된 노래를 비교하려 하면 입력을 보존하고 삭제 사실을 안내합니다. 목록에서 공개 전환·삭제가 충돌하면 최신 목록을 조회하고 다시 선택하도록 안내하며 자동으로 재시도하지 않습니다.

## 일정 조회와 페이지

- 달력은 기존 42일 격자 범위, 목록은 해당 월의 시작~마지막 날짜, 특정 날짜 목록은 그 하루만 조회합니다. 서버의 겹침 조건을 사용하므로 앞달에 시작한 기간 일정도 빠지지 않습니다.
- 목록은 서버 페이지 처리로 **50개씩** 읽고 전체 개수를 표시합니다. 2,000개가 넘어도 페이지를 통해 볼 수 있습니다. 달력·이미지 일괄 조회와 JSON 백업의 기존 2,000개 한도는 유지합니다. 한도를 넘는 달력에는 목록 보기 전환을 제공합니다.
- 페이지는 URL에 보관합니다. 월·보기·날짜·구분을 바꾸면 첫 페이지로 돌아가고, 가이드 왕복은 현재 페이지를 유지합니다. 삭제로 마지막 페이지가 비거나 범위를 벗어난 페이지를 열면 유효한 마지막 페이지로 이동합니다.
- **이번 달 일정 백업**은 현재 페이지나 선택 하루에 한정하지 않고 해당 월을 별도로 조회합니다. 기존처럼 구분 필터는 적용합니다. 한도 초과 시 오류를 표시하고 일부 페이지만 조용히 내보내지 않습니다.
- 노래 목록과 일정 목록은 공통 요청 모듈을 사용합니다. 새 요청이 시작되면 이전 요청을 취소하고, 늦게 끝난 성공·오류가 최신 화면을 덮지 못하게 합니다. 컴포넌트가 닫힌 뒤의 응답도 적용하지 않습니다.

## 날짜별 계산

한국 날짜의 시작/다음 날 경계는 한 날짜에 한 번 계산하고, 모든 일정과의 겹침 검사에 재사용합니다. 달력과 주간 이미지로 보내는 일정 분류가 같은 함수를 사용합니다. 서버가 준 순서를 유지하며 주간 이미지의 시간순 정렬도 보존합니다. 자정 종료일 제외·종일 종료일 포함·윤년·밤샘·장기간 일정 규칙은 유지합니다.

로컬 Node 24.11.1 합성 종일 일정, 42일 격자, 준비 실행 후 5회 중앙값:

| 일정 수 | 이전 코드 | 적용한 코드 | 날짜별 항목·순서 |
| --- | ---: | ---: | --- |
| 100개 | 9.55ms | 0.18ms | 일치 |
| 2,000개 | 194.29ms | 1.33ms | 일치 |

이 수치는 로컬 계산 비교이며 운영 브라우저·Worker 시간이나 요금 절감 측정값은 아닙니다. 원본 데이터와 계산 결과를 변경하지 않는지 함께 확인했습니다. 증거는 `.local/priority-review/performance.json`입니다.

## 공통 기능과 기능별 코드의 경계

| 위치 | 책임 | 사용하는 곳 |
| --- | --- | --- |
| `server/services/revisions.js` | 양의 정수 버전 검증. 오류 코드·안내는 호출한 기능이 결정 | 노래·개별 일정 검증 |
| `server/routes/songs.js` | 노래·CSV HTTP 처리. 공통 관리자 인증 뒤 호출 | `server/routes/admin.js` |
| `server/services/song-mutations.js` | 노래 수정·삭제 입력과 충돌 계약 | 노래 라우트 |
| `server/repositories/songs.js` | 노래 SQL과 원자적 버전 검사 | 노래 라우트 |
| `src/services/useAsyncResource.js` | 요청 취소·최신 응답 적용·로딩·오류 수명 관리 | 노래 목록·일정 조회 훅 |
| `shared/pagination.js` / `src/components/Pagination.vue` | 페이지 계산·쿼리 해석 / 이전·다음 공통 UI | 노래·일정 목록, 일정 메뉴·가이드 |
| `shared/schedule/event-time.js` | 한국 시각 변환·날짜 경계·겹침 계산 | 일정 검증·색인·조회 계산 |
| `shared/schedule/event-index.js` | 날짜별 일정 분류. 입력·순서 보존 | 달력·주간 이미지 투영 |
| `src/schedule/event-query.js` | 월/날짜/달력 조회 범위와 목록 날짜 묶음 | 일정 화면·조회 훅 |
| `src/schedule/useScheduleEvents.js` | 일정 조회와 페이지 보정의 Vue 상태 연결 | 일정 화면 |
| `src/services/song-admin.js` | 관리자 노래 조회·변경 요청과 버전 전달 | 노래 편집·목록·기존 폼 |
| `src/services/song-review.js` | 노래 항목 비교와 명시적 선택 병합, 부작용 없는 함수 | 충돌 비교 컴포넌트·단위 테스트 |
| `src/components/SongConflictReview.vue` | 항목별 비교·선택 UI | 노래 편집 화면 |

공통 헤더의 RouterLink 참조도 명시해 참고 UI의 컴포넌트 해석 경고를 정리했습니다. 다른 프레임워크·새 의존성·유료 서비스·정기 조회 작업은 추가하지 않았습니다.

이후 관리 기준은 다음과 같습니다.

1. `shared/`는 브라우저·서버에서 쓸 수 있는 순수 규칙만 둡니다. Vue·DOM·DB·API 클라이언트를 가져오지 않습니다.
2. 서버의 공통 인증은 관리자 라우트 입구에서 유지합니다. 기능 라우트는 요청·응답, 서비스는 검증·규칙, 저장소는 SQL을 담당합니다.
3. 화면은 입력·표시·사용자 동작을 연결합니다. 조회 수명과 페이지 상태는 훅에, 범위·비교·변환처럼 따로 검증할 함수는 해당 기능의 모듈에 둡니다.
4. 실제로 공유하는 동작만 공통화합니다. 서로 다른 노래·주간 메모·개별 일정의 입력 계약을 하나의 큰 범용 함수나 `utils` 파일에 합치지 않습니다.
5. 변경한 규칙과 같은 이름의 테스트 파일을 함께 수정합니다. 테스트의 공통 로그인·인증 헤더는 `tests/e2e/support/admin.js`, 기능 검증은 `song-conflicts.spec.js`와 `schedule-pagination.spec.js`로 나눕니다.

## 적용·검증과 운영 주의점

실행 마이그레이션은 `migrations/0006_song_revisions.sql`, 참고 사본은 `database/migrations/0006_song_revisions.sql`입니다. 기존 사용자가 수정한 `database/migrations/0001_initial.sql`과 참고 ZIP은 보존하고 커밋에서 제외합니다. 작업 전 소스·Git 상태는 `.local/priority-before-1792214419355/`에 보관했습니다.

로컬과 운영 DB는 각각 백업 후 해당 환경의 마이그레이션을 적용합니다. 배포 전에 원격 DB에 컬럼이 있어야 합니다. 이미 열린 예전 화면은 새로고침해야 새 버전 입력을 보낼 수 있으며, 버전 없는 쓰기는 덮어쓰지 않고 거부합니다. 기존 로그인은 유지합니다.

단위/API, 실제 브라우저 전체, 참고 UI를 검사합니다. 기준 크기는 1920×1080, 1440×900, 768×1024, 390×844, 360×800입니다. 보호 UI의 운영 확인에는 테스트 GET 응답을 사용하고 실제 저장·삭제는 차단합니다. 운영 데이터로 동시 수정이나 삭제를 재현하지 않습니다.

최종 검증 수·커밋·운영 버전과 파일 목록은 아래에 기록합니다. 의존성 갱신 검토, 로그인 확인 요청 중복 완화, 개별 일정 복사 제안은 후속 검토 항목으로 남깁니다.


## 최종 로컬 검증

단위·API 81개, 실제 브라우저 고유 항목 52개, 참고 UI 6개로 **총 139개 통과**했습니다. 전체 브라우저 실행은 51개 통과 후 한 항목이 로컬 GET 연결 끊김(ECONNRESET)으로 종료됐고, 서버 재시작 후 해당 항목과 최종 변경 관련 5개를 모두 통과했습니다. 재실행한 항목은 총수에 중복 합산하지 않았습니다. 코드 형식 정리 후 빌드도 성공했습니다.

증거는 `.local/priority-review/checks.json`, `e2e-all/`, `e2e-final/`, `ui-final/`, `screenshots/`입니다. API 저장 검증은 격리 DB, 브라우저 실사용 검증은 격리 E2E DB를 사용합니다. 대량 일정 UI 검증에는 GET 테스트 응답을 사용하며 실제 D1의 2,051건 페이지 조회는 API 테스트로 확인했습니다.

## 변경 파일

아래 44개 파일만 이번 변경에 포함합니다.

```text
README.md
docs/02_ARCHITECTURE.md
docs/03_API.md
docs/20_POST_GUIDE_REVIEW.md
docs/21_PRIORITY_REFACTOR.md
migrations/0006_song_revisions.sql
database/migrations/0006_song_revisions.sql
server/repositories/songs.js
server/routes/admin.js
server/routes/songs.js
server/services/event-validation.js
server/services/revisions.js
server/services/song-mutations.js
shared/pagination.js
shared/schedule/events.js
shared/schedule/event-time.js
shared/schedule/event-index.js
src/components/AppHeader.vue
src/components/Pagination.vue
src/components/SongForm.vue
src/components/SongConflictReview.vue
src/components/schedule/ScheduleNav.vue
src/pages/AdminSchedule.vue
src/pages/AdminScheduleGuide.vue
src/pages/AdminSongs.vue
src/pages/SongEditor.vue
src/schedule/event-query.js
src/schedule/useScheduleEvents.js
src/schedule/events-service.js
src/services/song-adapter.js
src/services/song-draft.js
src/services/useSongs.js
src/services/useAsyncResource.js
src/services/song-admin.js
src/services/song-review.js
src/views/SongFormView.vue
tests/api.test.js
tests/pagination.test.js
tests/schedule-query.test.js
tests/song-review.test.js
tests/e2e/integration.spec.js
tests/e2e/song-conflicts.spec.js
tests/e2e/schedule-pagination.spec.js
tests/e2e/support/admin.js
```

## 운영 배포 완료

2026-10-17 14:40:44 (Asia/Seoul) 확인. 실행 소스 `036ff81`, Worker `1b0b139a-ebef-485a-bd96-67567222d129`를 운영에 배포했습니다. 소스는 GitHub `codex/phase1`에 반영했고 문서 확인 결과는 뒤이은 커밋으로 기록합니다.

- 로컬·원격 DB를 각각 내보내 백업한 뒤 migration 0006을 적용했습니다. 두 환경 모두 노래·관리자·개별 일정·주간 메모의 행 수가 전후 동일하고 revision 컬럼이 준비됐습니다. 원격 백업은 `.local/backups/priority-remote-1792215500355/database.sql`, 로컬 백업은 `.local/backups/priority-local-1792215152415/database.sql`입니다. 비밀값이 있는 백업과 로그는 Git에서 제외합니다.
- 원격 첫 조회에서 Cloudflare 7403 접근 오류가 한 차례 발생했습니다. 로그인 계정·권한과 D1 목록/읽기를 재확인한 뒤 요청이 정상으로 돌아왔고, 그 이후에 백업·마이그레이션·배포를 진행했습니다. 계정·토큰 설정은 변경하지 않았습니다.
- 운영 D1 health 정상, 공개 자산 **65개** SHA256이 최종 빌드와 일치합니다. 노래·일정 조회 및 주간 메모 삭제를 포함한 익명 접근 8개를 차단하고 보호 화면의 로그인 복귀를 확인했습니다.
- 운영 파일로 PC 1440px·모바일 390px·360px의 날짜 등록·가이드·노래 충돌 비교·일정 2페이지를 확인했습니다. 목록은 한 요청에 50개를 요구하고 55개 자료의 2페이지에 5개를 표시했습니다. 오류에 초점을 옮기고 비교 후 서버의 비공개 메모를 유지하는 동작도 확인했습니다.
- 기존 주간 이미지 출력 PNG 1672×941, 주간 삭제 미리보기·취소를 확인했습니다. 페이지 오류·CSP 위반·가로 넘침은 없었습니다.
- 보호 UI에는 격리 브라우저의 GET 테스트 응답을 사용했습니다. 노래 충돌 재현 요청 3개는 브라우저에서 409 테스트 응답으로 차단했으며 실제 운영 계정·노래·일정·메모를 수정하지 않았습니다. 실제 저장·동시 수정·삭제 권한은 앞선 로컬 API/E2E 검증 범위입니다.

운영 증거: `.local/priority-review/production/verification.json`, `production/priority-ui.json`, `migration-local.json`, `migration-remote.json`. 소스와 별개로 남아 있던 사용자 SQL 수정과 참고 ZIP도 원문 그대로 유지했습니다.

[운영 홈페이지](https://zio-home.ryan9320.workers.dev) · [노래 관리](https://zio-home.ryan9320.workers.dev/admin/songs) · [일정 목록](https://zio-home.ryan9320.workers.dev/admin/schedule?view=list). 이미 열어 둔 화면은 새로고침한 뒤 사용합니다.
