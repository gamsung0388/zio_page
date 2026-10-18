# UI·테마 검증 기록

2026-10-18, ZIO HOME. 관리자 기본 테마와 방문자 개인 선택, 숲속 음악 공간 UI.

## 확인한 결과

- 단위·실제 D1 API 통합 테스트: 114개 통과.
- 전체 브라우저 회귀 테스트: 82개 통과. 최종 소스에서 GitHub Actions의 Chromium 전체 재검증도 통과했습니다.
- 기존 참고 UI 테스트: 6개 통과. 고유 테스트 총 202개.
- 저장 충돌 후 다른 테마를 선택하거나 선택 취소해도 최신 설정 불러오기를 계속 제공합니다.
- 별빛·햇살 테마에서 일정 PNG 내보내기 결과가 기본 테마와 바이트 단위로 같으며, 모바일·확대·JPEG도 기존 크기를 유지합니다.
- Vite 운영 빌드 성공. 테마 이미지 두 개는 합계 약 282KB이고 로컬 WebP·버전 경로·장기 캐시를 사용합니다.
- 1920×1080, 1440×900, 768×1024, 390×844, 360×800에서 세 가지 테마의 메인·노래목록·상세·등록·수정·설정을 확인했습니다. 가로 넘침과 공개 상세의 비공개 메모 노출이 없습니다.
- 관리자 미리보기는 저장 요청을 보내지 않고 종료 시 개인 선택으로 돌아갑니다. 방문자 선택은 같은 브라우저에서 유지되고 별도 브라우저에 전파되지 않습니다.
- 인증·초기 비밀번호 변경·Origin·CSRF, 설정 버전 충돌, 허용되지 않은 입력, 저장 공간 오류, 설정 조회 실패를 확인했습니다.
- 운영 백업·격리 복원: .local/backups/verified-20261018194019-5c928ca3, 10개 테이블 무결성 정상, 운영 쓰기 0건. 최초 백업은 OAuth 인증 오류로 실패했고 로그인 갱신 후 재검증했습니다. 비공개 백업은 Git에 포함하지 않습니다.
- 사용자 원본 database/migrations/0001_initial.sql과 ZIP은 보존합니다. DB 스키마 변경은 없습니다.

## 변경 구성

shared/appearance.js, server/repositories/appearance.js, server/routes/appearance.js로 설정 검증·저장·접근을 분리했습니다. src/services/appearance.js와 공통 ThemeChoices·ThemePicker·SceneBanner·SiteSettingsTabs를 재사용합니다. 색상 중복은 themes.css 토큰으로 모으고 기존 페이지의 검색·로그인·저장·비공개 메모 처리는 유지했습니다.

세부 파일 목록·배포 소스·운영 화면 검증 JSON은 작업 디렉터리의 .local/appearance-review에 기록합니다. 사용 방법·생성 이미지 저장 경로·내장 imagegen 프롬프트는 appearance-guide.md에 있습니다.

## 현재 범위

기본 커버는 장르별 일러스트입니다. 실제 앨범 조회·이미지 업로드, 게시판/CMS, 즐겨찾기, SOOP API는 이 변경에 포함하지 않습니다. 운영 사이트에서 관리자 화면의 시각 검증은 읽기 전용 테스트 응답으로 수행하고 실제 관리자 API의 비인증 차단을 별도 확인합니다. 운영 콘텐츠를 만들거나 바꾸지 않습니다.

## 배포 확인

- 운영 주소: https://zio-home.com (기본 workers.dev 주소도 확인).
- 배포 소스: 882ae1a81bd3a42d54f7599691c5c87f85c6636a.
- Cloudflare Worker 버전: 27217132-c995-4abf-b6ba-028d93476fb0.
- 독립 검증: https://github.com/gamsung0388/zio_page/actions/runs/39120727154 — 단위/API 114개, 브라우저 82개, 참고 UI 6개 및 운영 빌드 성공.
- 운영 파일 83개가 로컬 빌드와 SHA-256 기준 일치합니다. DB 상태 ready, 비인증 관리자 접근 401, 관리자 가이드 로그인 복귀 정상.
- 운영 화면 오류·Vue 경고·앱 CSP 위반 0건. 실제 데이터 로딩을 기다린 홈 화면도 세 가지 테마 × 다섯 크기에서 확인했습니다. 방문자 선택 유지·기본값 복귀·관리자 임시 미리보기 정상.
- 운영 쓰기 0건. 관리자 화면은 GET 응답만 격리 대체하여 검증했으며 실제 서비스 데이터·계정·기본 테마를 변경하지 않았습니다.
- 테마 이미지 장기 캐시와 공개 노래 API 200을 확인했습니다.
- 기존 외부 설정 관찰: HTTP URL은 아직 200이며 Location은 없습니다. Cloudflare 자동 분석 스크립트 차단 25건은 기존 CSP 설정에 따른 것으로 앱 오류와 분리했습니다. 이 작업에서 도메인 설정·보안 헤더 정책을 완화하지 않았습니다.
- 이미지 원본과 웹용 파일/생성 프롬프트는 appearance-guide.md에 기록했습니다.

## 변경 파일 목록

- README.md
- docs/appearance-guide.md
- docs/appearance-qa.md
- public/_headers
- public/images/themes/forest-room-v1.webp
- public/images/themes/zio-cutout-v1.webp
- server/repositories/appearance.js
- server/routes/admin.js
- server/routes/appearance.js
- server/routes/public.js
- shared/appearance.js
- src/App.vue
- src/assets/main.css
- src/components/AppHeader.vue
- src/components/SceneBanner.vue
- src/components/SiteSettingsTabs.vue
- src/components/ThemeChoices.vue
- src/components/ThemePicker.vue
- src/main.js
- src/pages/AdminAppearance.vue
- src/pages/AdminHome.vue
- src/pages/AdminMenus.vue
- src/router/index.js
- src/services/admin-navigation.js
- src/services/appearance.js
- src/services/return-to.js
- src/services/song-adapter.js
- src/services/song-cover.js
- src/styles/controls.css
- src/styles/integration.css
- src/styles/main.css
- src/styles/management.css
- src/styles/navigation.css
- src/styles/themes.css
- src/ui-preview/main.js
- src/views/HomeView.vue
- src/views/SongDetailView.vue
- src/views/SongFormView.vue
- tests/api.test.js
- tests/appearance.test.js
- tests/e2e/appearance.spec.js
- tests/e2e/prepare.js
- tests/e2e/schedule.spec.js
