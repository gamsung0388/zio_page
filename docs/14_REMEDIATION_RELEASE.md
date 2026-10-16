# 14. 개선 항목 수정·검증·배포 기록

작업일: 2026-10-16 (Asia/Seoul). [13 수정 전 분석](13_IMPROVEMENT_REVIEW.md)의 R1–R9와 관련 후보를 반영했습니다. 기존 Vue/Workers/D1, 노래·계정 API, 비공개 메모 분리, 관리자 인증·Origin·CSRF 및 강제 비밀번호 변경을 유지합니다.

## 수정 결과

| 항목 | 적용 내용 |
|---|---|
| R1 초안 | 일정 이미지·달력 날짜·노래 등록/수정에 계정/대상별 임시 초안, 재로그인 후 복구/버리기, 저장 성공 정리, 로그아웃 미저장 확인 |
| R2 날짜 | 날짜/월 선택 이동을 기다린 뒤 실제 경로의 선택값으로 입력칸 동기화. 취소·실패 시 원래 값 유지 |
| R3 이미지 | 넘친 칸 강조, 출력 전 실제 글자 영역 검사, 잘린 출력 차단, 내용/시간 글자 자동 축소. 최소 크기로도 넘치면 내용 수정 안내 |
| R4 소스 보관 | 사용자 SQL 조회문·ZIP·비밀값·로컬 DB·백업을 제외한 실제 UI/일정/migration/수정 소스를 codex/phase1에 기록 |
| R5 선택 주 | 현재 탭 재클릭·달력/이미지 탭 전환 시 주/월 유지, 이번 주 이동은 별도 버튼 |
| R6 복귀 | 로그인과 강제 비밀번호 변경 후 원래 내부 관리 화면·주로 복귀. 외부/미등록/인증 순환 경로 거부 |
| R7 결과 | 실패는 alert, 진행/성공은 status. 미저장 주·변경·저장 완료·한국 시간 마지막 저장 구분, 공통 알림 정리·자동 종료 |
| R8 배치 | PC 입력/미리보기 좌우, 미리보기 고정. 모바일 입력 우선, 요일 선택, 꾸미기 접기. 일정 저장/저장된 일정 불러오기 문구 |
| R9 반복 작업 | 휴방/미정·전날 복사, 지난주 내용/시간/스타일 선택 복사, 현재 주·전체 JSON 백업, 검증 후 선택 주 가져오기 |

추가로 정상 로그인은 제한 횟수에 누적하지 않고 다른 실패 기록은 유지합니다. 한국 자정/화면 복귀 때 오늘 날짜를 갱신하며 편집 중인 월/주는 바꾸지 않습니다. 변경/추가된 소스 71개의 형식을 정리했습니다. 템플릿 미리보기 8종은 합계 38,116바이트이며 원본 PNG는 디코딩한 픽셀 해시가 같은 것을 확인하고 합계 12,085,145 → 11,303,473바이트로 줄였습니다.

## 보관·복사·복원의 의미

- 초안은 같은 브라우저 탭의 sessionStorage, 사용자 ID와 편집 대상별 최대 24시간입니다. 비밀번호·토큰을 포함하지 않습니다. 탭 종료/저장 거부 때는 보장되지 않으며 저장 거부를 화면에 안내합니다. 자발적 로그아웃은 해당 계정 초안을 삭제합니다.
- 초안 복구는 수동이며 자동으로 서버를 덮어쓰지 않습니다. 일정은 원래 revision으로 복구하므로 최신 변경과 충돌하면 409입니다. 노래는 작성 후 서버 저장 시각이 바뀌었으면 복구 전 확인합니다.
- 지난주 복사는 내용/시간/스타일을 선택해 현재 주의 입력만 바꿉니다. 전날 복사도 확인 후 적용합니다.
- 현재 주 JSON은 미저장 입력도 포함합니다. 전체 JSON은 저장된 일정만 인증 API에서 50주씩 가져옵니다. 최대 2,000주/10MB이며 초과 파일은 출력/가져오기를 거부합니다.
- 백업 검증은 버전/날짜/월요일/중복/알 수 없는 필드/길이/로컬 템플릿/글자 옵션을 확인합니다. 파일에서 한 주를 고른 뒤 현재 편집 주에 적용하고, 확인 후 기존 일정 저장으로 반영합니다. 여러 주를 무조건 덮어쓰는 복원은 제공하지 않습니다.
- 글자 자동 맞춤은 내용/시간 공통 크기를 각각 허용 최소값까지 줄입니다. 데이터는 자르지 않습니다. 여러 줄이 여전히 넘치면 다운로드를 차단합니다. PNG/JPEG 규격은 1672×941px입니다.

## 검증

최종 단위·API 53개, 실제 브라우저 27개, 참고 UI 6개로 총 86개가 통과했습니다. 운영 빌드도 성공했습니다. 운영 의존성 audit는 0건이며 개발 도구 전이 의존성의 high 3건은 다음 분석에 분리했습니다. 배포 버전과 운영 확인은 아래에 기록합니다. 검증에는 기존 CRUD/CSV/비공개 메모/관리자 계정, 401 후 일정·노래·날짜 초안, 다른 계정 격리, 날짜 이동 취소, 현재 탭 유지, 넘침 차단/자동 맞춤, JSON 검증/복사, API 권한·동시 수정, PC/모바일 PNG 픽셀 동일성을 포함합니다.

반응형 기준: 1920×1080 / 1440×900 / 768×1024 / 390×844 / 360×800. `.local/schedule-review/screenshots/` 및 `.local/integration-review/screenshots/`에 캡처했고 대표 화면을 직접 확인했습니다. 테스트는 Miniflare와 `.local/e2e/state`만 사용하며 운영 계정·노래·일정을 테스트 데이터로 변경하지 않습니다.

## 보존과 운영

- 시작 상태/파일: `.local/remediation-before-1792159901686/`. 이전 UI·일정 작업 보관도 유지합니다.
- 사용자가 먼저 추가한 `database/migrations/0001_initial.sql` 끝의 조회문은 그대로 보존하고 실행/커밋하지 않습니다. 실제 migration은 `migrations/`입니다. 참고 ZIP도 보존하며 커밋에서 제외합니다.
- 이번 안정화는 새 DB migration을 요구하지 않습니다. 이미 운영 적용된 0004와 UI/일정 소스를 함께 기록해 신규 체크아웃도 재현 가능하게 합니다.
- 새 유료 서비스·정기 폴링·외부 방송 연동을 추가하지 않습니다. SOOP 승인/표지 저장/API, 공개 일정표는 별도 확장입니다.
- 설치/실행은 README의 npm ci → 로컬 migration/관리자 → dev 순서입니다. 배포는 기존 npm run deploy를 사용합니다. GitHub 자동 배포는 별도 설정하지 않았습니다.

## 변경 파일

주요 화면은 `src/pages/AdminScheduleImage.vue`, `AdminSchedule.vue`, `SongEditor.vue`, `AdminLogin.vue`, `AdminPassword.vue`, 공유 폼 `src/views/SongFormView.vue`입니다. 초안/복귀/알림은 `src/services/`, 일정 검사/백업은 `shared/schedule/`와 `src/schedule/`, 인증된 전체 백업은 `server/routes/schedules.js`·`server/repositories/schedules.js`, 로그인 예약 정리는 `server/services/auth.js`·`server/repositories/auth.js`입니다. 공통 레이아웃·기존 UI 통합 소스, 템플릿/미리보기와 테스트·문서도 함께 기록합니다. 실제 커밋의 파일 목록을 최종 목록으로 사용합니다.


<details>
<summary>이번 소스 기록의 변경 파일 116개</summary>

```text
CODEX_PROMPT.md
README.md
database/migrations/0004_admin_schedule_weeks.sql
docs/01_PRODUCT.md
docs/03_API.md
docs/04_SECURITY.md
docs/06_PHASE2_SCHEDULE.md
docs/10_UI_REVIEW.md
docs/11_UI_INTEGRATION.md
docs/12_ADMIN_SCHEDULE.md
docs/13_IMPROVEMENT_REVIEW.md
docs/14_REMEDIATION_RELEASE.md
docs/CODEX_PROMPT.md
docs/UI_REFERENCE_README.md
docs/UI_SPEC.md
docs/reference-ui.png
migrations/0004_admin_schedule_weeks.sql
package-lock.json
package.json
playwright.ui.config.js
public/images/covers/cherry.svg
public/images/covers/city.svg
public/images/covers/night.svg
public/images/covers/ocean.svg
public/images/covers/room.svg
public/images/covers/sunset.svg
public/images/schedule/thumbs/zio-schedule-template.webp
public/images/schedule/thumbs/zio-schedule-template2.webp
public/images/schedule/thumbs/zio-schedule-template3.webp
public/images/schedule/thumbs/zio-schedule-template4.webp
public/images/schedule/thumbs/zio-schedule-template5.webp
public/images/schedule/thumbs/zio-schedule-template6.webp
public/images/schedule/thumbs/zio-schedule-template7.webp
public/images/schedule/thumbs/zio-schedule-template8.webp
public/images/schedule/zio-schedule-template.png
public/images/schedule/zio-schedule-template2.png
public/images/schedule/zio-schedule-template3.png
public/images/schedule/zio-schedule-template4.png
public/images/schedule/zio-schedule-template5.png
public/images/schedule/zio-schedule-template6.png
public/images/schedule/zio-schedule-template7.png
public/images/schedule/zio-schedule-template8.png
public/images/zio-reference.png
server/repositories/auth.js
server/repositories/schedules.js
server/routes/admin.js
server/routes/schedules.js
server/services/auth.js
server/services/schedule-validation.js
shared/schedule/dates.js
shared/schedule/scheduleConfig.js
shared/schedule/scheduleFactory.js
shared/schedule/validation.js
src/App.vue
src/assets/main.css
src/components/AppHeader.vue
src/components/AppSidebar.vue
src/components/CoverImage.vue
src/components/DraftRecovery.vue
src/components/LeafRating.vue
src/components/SongCard.vue
src/components/StatusPill.vue
src/components/schedule/ScheduleNav.vue
src/components/schedule/ZioEditorToolbar.vue
src/components/schedule/ZioScheduleCanvas.vue
src/components/schedule/ZioScheduleField.vue
src/data/mockSongs.js
src/main.js
src/pages/AdminLogin.vue
src/pages/AdminPassword.vue
src/pages/AdminSchedule.vue
src/pages/AdminScheduleImage.vue
src/pages/AdminSongs.vue
src/pages/AdminUsers.vue
src/pages/Home.vue
src/pages/SongDetail.vue
src/pages/SongEditor.vue
src/pages/Songs.vue
src/router/index.js
src/schedule/backup.js
src/schedule/exportImage.js
src/schedule/imageLoading.js
src/schedule/scheduleLayout.js
src/schedule/useKstToday.js
src/schedule/useScheduleEditor.js
src/services/draft-storage.js
src/services/editor-guards.js
src/services/notifications.js
src/services/return-to.js
src/services/song-adapter.js
src/services/songService.js
src/services/useEditorDraft.js
src/styles/integration.css
src/styles/schedule.css
src/ui-preview/App.vue
src/ui-preview/main.js
src/ui-preview/song-adapter.js
src/ui-preview/songService.js
src/views/AboutView.vue
src/views/HomeView.vue
src/views/ScheduleView.vue
src/views/SongDetailView.vue
src/views/SongFormView.vue
src/views/SongsView.vue
tests/api.test.js
tests/e2e/integration.spec.js
tests/e2e/prepare.js
tests/e2e/recovery.spec.js
tests/e2e/schedule.spec.js
tests/e2e/site.spec.js
tests/recovery.test.js
tests/schedule.test.js
tests/ui-adapter.test.js
tests/ui/preview.spec.js
ui-preview.html
vite.ui.config.js
```

</details>

배포 후 경계 점검에서 풍 개수를 비우고 작성 중인 노래 초안이 초기 숫자 타입과 달라 복구에서 제외될 수 있음을 확인해 보완했습니다. 초안은 미완성 숫자 입력도 보관하며 최종 저장 검증은 그대로 유지합니다. 손상된 링크/타입은 복구에서 거부합니다. 노래 공개 전환·삭제·CSV 알림도 공통 알림 함수로 통일했습니다. 추가 소스는 src/services/song-draft.js 및 두 회귀 테스트에 포함됩니다.
