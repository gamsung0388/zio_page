# 11. 새 UI와 실제 기능 통합

검증일: 2026-10-16 (Asia/Seoul). 사용자의 “모두 수정 가보자” 요청에 따라 UI 확인 단계를 마치고 기존 Worker/D1/API에 새 화면을 연결했습니다. 이후 사용자의 “배포도 해줘” 요청에 따라 운영 배포를 완료했습니다. 이번 변경의 GitHub 업로드는 별도로 수행하지 않았습니다.

## 실행과 화면

- 실제 앱: `npm run dev` → http://127.0.0.1:5173/ . 로컬 D1을 사용하므로 운영 계정·노래와 별개입니다. 상태 확인: `/api/health?db=1` 200 / database ready.
- 기존 경로 `/`, `/songs`, `/songs/:id`, `/admin/login`, `/admin`, `/admin/users`, `/admin/password`, `/admin/password-reset`, `/admin/songs`를 유지합니다.
- 추가 경로 `/about`, `/admin/songs/new`, `/admin/songs/:id/edit`. 편집 경로도 기존 관리자 가드를 적용합니다.
- 참고 UI: `npm run dev:ui` → http://127.0.0.1:5175/ui-preview.html . 예시 앱은 분리해 보존하며 운영 앱은 mock service를 사용하지 않습니다.

## 완료 내용

1. Sidebar/Header와 카드·잎사귀 숙련도·상태 표시를 공유하고 요청한 녹색 계열을 적용했습니다. 홈 배너 높이를 줄였습니다. 모바일 메뉴는 배경 접근 차단, 키보드 이동 제한, Escape 닫기와 초점 복원을 제공합니다.
2. 공개 홈·목록·상세는 기존 공개 API를 사용합니다. 관리자 메모는 공개 응답과 화면에 포함하지 않으며 비공개 곡은 공개 목록·상세에서 조회되지 않습니다.
3. 로그인과 관리자 세션을 유지하고 노래 관리와 관리자 계정 관리를 별도 메뉴로 제공합니다. 계정 등록·비밀번호 변경·초기화 및 강제 비밀번호 변경 흐름을 유지했습니다.
4. 검색, 숙련도 5단계, 네 가지 연습 상태, 장르·언어, 관리자 공개 여부, 풍 개수 등 정렬과 페이지 이동을 기존 서버 목록 서비스에 연결했습니다. URL·새로고침·상세에서 돌아가기 시 목록 조건을 유지합니다.
5. 등록·수정은 같은 SongFormView와 검증·필드 어댑터를 사용합니다. 실제 POST/PATCH를 기다리는 동안 입력·중복 제출을 막고 오류가 발생하면 입력을 유지합니다. 저장하지 않은 변경에 이동·새로고침 확인을 제공합니다.
6. 수정 화면의 직접 접근·새로고침을 지원하는 GET `/api/admin/songs/:id`만 서버에 추가했습니다. 기존 requireAdmin 검사 뒤 기존 getSong 저장소 함수를 호출하며 공개 API는 변경하지 않습니다.
7. 기존 CSV 미리보기·서버 검증·일괄 추가·전체 백업과 삭제·공개 전환을 새 관리 화면에서 제공합니다.
8. 공통 CoverImage로 기본 커버, 로딩 실패 시 대체, 고정 크기와 비율, lazy loading/async decoding을 적용했습니다. 상세 주 이미지는 즉시 로드합니다.

## 검증

| 검증 | 결과 |
|---|---|
| npm test | 37개 통과. 권한·CSRF·세션·CRUD·검색·CSV·계정 관리·어댑터 및 관리자 단건 조회 |
| npm run test:e2e | 11개 통과. 실제 Worker와 격리된 로컬 D1 사용 |
| npm run test:ui | 6개 통과. 기존 참고 UI의 화면·검색·등록·수정·공개 분리·모바일 키보드 검증 |
| npm run build | Worker / 프런트 빌드 성공 |
| npm run build:ui | 참고 UI 빌드 성공 |
| npm run db:migrate:local | 추가 적용할 migration 없음 |

실제 앱은 1920×1080, 1440×900, 768×1024, 390×844, 360×800에서 홈·목록·상세·등록·수정·관리자 메뉴 총 30개 화면을 캡처했습니다. 가로 넘침 및 브라우저 실행 오류가 없고 대표 화면을 직접 확인했습니다. 캡처는 `.local/integration-review/screenshots/`에 있습니다. 참고 UI 캡처 25개는 `.local/ui-review/screenshots/`입니다.

추가 검증은 저장 연결 오류 시 초안·연습 상태 유지, 중복 요청 차단, 미저장 이동 취소/승인, 22곡 검색·복합 필터·풍 정렬·페이지 이동·새로고침·조건 복원, 이미지 실패 대체를 포함합니다. 실제 CSV 가져오기·다운로드와 관리자 계정 등록·초기화·변경도 통과했습니다. 예시 HTML, demo-001 및 예시 메모 문자열이 운영 빌드에 없는 것을 확인했습니다.

## 보존과 주의점

- 시작 Git 상태와 tracked 패치·파일은 `.local/integration-1792156108898/`에 보관했습니다. UI 패키지 최초 복사 상태 전체는 `.local/ui-review/before-20261016-1792152945183/`에 보관되어 있습니다.
- 보호 대상 27개 파일 중 의도한 변경은 `server/routes/admin.js`와 `src/router/index.js`뿐입니다. DB 스키마, 실행 migrations, 인증·권한·CSRF·CSV·저장소, API 클라이언트, 목록 서비스, Wrangler, lockfile은 동일합니다.
- 사전에 사용자가 변경한 `database/migrations/0001_initial.sql` 끝의 조회문은 그대로 보존했으며 실행하지 않았습니다. 실제 migration 경로는 `migrations/`입니다.
- 이미지 업로드·관련 링크의 영구 저장은 현 DB/API 계약에 없습니다. 따라서 실제 등록·수정 폼에 해당 입력을 노출하지 않습니다. 기본 이미지는 장식용이며 실제 앨범 표지로 표시하지 않습니다. 향후 저장 위치·필드 계약을 정한 뒤 연결해야 합니다.
- SOOP 심사 중이므로 자동 방송 상태·후원 인식·노래 신청 처리·API 키 저장을 추가하지 않았습니다. 방송국 링크는 유지합니다. 방송 일정표 및 다른 스트리머 지원도 추가하지 않았습니다.
- 유료 서비스·새 의존성·자동 폴링·정기 작업을 추가하지 않았습니다. 정적 자산과 같은 도메인의 기존 API를 사용합니다.
- 운영 반영 시 DB migration 없이 기존 배포 명령을 사용합니다. 운영 계정 생성/초기화나 운영 노래 변경을 테스트 목적으로 수행하지 않았습니다.

## 파일별 역할

- 앱 공통: `src/App.vue`, `src/main.js`, `src/components/AppSidebar.vue`, `AppHeader.vue`, `SongCard.vue`, `CoverImage.vue`, `LeafRating.vue`, `StatusPill.vue`, `src/assets/main.css`, `src/styles/integration.css`.
- 실데이터 화면: `src/pages/Home.vue`, `Songs.vue`, `SongDetail.vue`, `AdminSongs.vue`, `SongEditor.vue`; 공유 화면 `src/views/HomeView.vue`, `SongDetailView.vue`, `SongFormView.vue`, `AboutView.vue`.
- 연결: `src/services/song-adapter.js`, `notifications.js`, `src/router/index.js`, `server/routes/admin.js`.
- 테스트: `tests/api.test.js`, `tests/e2e/site.spec.js`, `tests/e2e/integration.spec.js`, `tests/ui-adapter.test.js`, `tests/ui/preview.spec.js`.
- 참고 패키지 보존: `src/ui-preview/`, `src/data/`, `src/services/songService.js`, 나머지 `src/views/`, `ui-preview.html`, `vite.ui.config.js`, `playwright.ui.config.js`, `docs/UI_REFERENCE_README.md`, `docs/UI_SPEC.md`, `docs/CODEX_PROMPT.md`, `docs/reference-ui.png`, `public/images/`. ScheduleView는 원본 참고 파일이며 운영에서 import/라우팅하지 않습니다.
- 안내: README, API 계약 문서, 이전 UI 확인 기록 및 본 문서. package.json은 기존 의존성을 유지하고 참고 UI 실행·검증 스크립트만 추가했습니다.

### 최종 Git 변경 목록 (기존 사용자 변경과 참고 파일 포함)

```text
수정 README.md
수정 database/migrations/0001_initial.sql
수정 docs/03_API.md
수정 package.json
수정 server/routes/admin.js
수정 src/App.vue
수정 src/main.js
수정 src/pages/AdminSongs.vue
수정 src/pages/Home.vue
수정 src/pages/SongDetail.vue
수정 src/pages/Songs.vue
수정 src/router/index.js
수정 tests/api.test.js
수정 tests/e2e/site.spec.js
추가 docs/10_UI_REVIEW.md
추가 docs/CODEX_PROMPT.md
추가 docs/UI_REFERENCE_README.md
추가 docs/UI_SPEC.md
추가 docs/reference-ui.png
추가 playwright.ui.config.js
추가 public/images/covers/cherry.svg
추가 public/images/covers/city.svg
추가 public/images/covers/night.svg
추가 public/images/covers/ocean.svg
추가 public/images/covers/room.svg
추가 public/images/covers/sunset.svg
추가 public/images/zio-reference.png
추가 src/assets/main.css
추가 src/components/AppHeader.vue
추가 src/components/AppSidebar.vue
추가 src/components/CoverImage.vue
추가 src/components/LeafRating.vue
추가 src/components/SongCard.vue
추가 src/components/StatusPill.vue
추가 src/data/mockSongs.js
추가 src/pages/SongEditor.vue
추가 src/services/notifications.js
추가 src/services/song-adapter.js
추가 src/services/songService.js
추가 src/styles/integration.css
추가 src/ui-preview/App.vue
추가 src/ui-preview/main.js
추가 src/ui-preview/song-adapter.js
추가 src/ui-preview/songService.js
추가 src/views/AboutView.vue
추가 src/views/HomeView.vue
추가 src/views/ScheduleView.vue
추가 src/views/SongDetailView.vue
추가 src/views/SongFormView.vue
추가 src/views/SongsView.vue
추가 tests/e2e/integration.spec.js
추가 tests/ui-adapter.test.js
추가 tests/ui/preview.spec.js
추가 ui-preview.html
추가 vite.ui.config.js
추가 docs/11_UI_INTEGRATION.md
```

## 운영 배포 확인 (2026-10-16)

- 사이트: https://zio-home.ryan9320.workers.dev
- Worker 버전: `e7d8a287-cd5d-4ec6-bb6b-4315e77ead21`
- 기존 `npm run deploy`로 빌드·정적 자산 업로드·Worker 배포 성공. 기존 D1 바인딩을 유지하며 스키마 변경이나 운영 계정·노래 수정은 수행하지 않았습니다.
- 운영 HTML과 JavaScript/CSS·캐릭터·기본 커버가 로컬 최종 빌드와 동일함을 확인했습니다.
- health/D1 ready 200, 공개 노래 API 200, 익명 관리자 목록·단건·계정 목록·CSV 접근 401을 확인했습니다.
- 실제 운영 홈·노래책자·로그인 화면을 PC 1440×900 및 모바일 390×844에서 확인했습니다. 가로 넘침·브라우저 실행 오류가 없고 보호된 등록 경로는 로그인으로 이동합니다. 공개 노래가 없어 운영 상세 화면 검증은 생략했으며 상세/CRUD는 앞선 격리된 D1 브라우저 테스트로 검증했습니다.
- 확인 결과와 화면 캡처: `.local/deploy-review/`.
