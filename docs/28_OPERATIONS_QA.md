# 운영 기능·앨범 연결 검증 기록

2026-10-23. [사용법과 설계](27_OPERATIONS_AND_ALBUMS.md).

## 로컬 검증

- 단위/Miniflare·D1 API 129개, 전체 브라우저 회귀 89개, 참고 UI 6개 통과. 고유 테스트 총 224개입니다.
- 최종 모바일 버튼 스타일 보완 후 1920×1080, 1440×900, 768×1024, 390×844, 360×800의 공개 노래 검색·홈페이지 관리·휴지통·노래 등록·관리자 목록을 재확인했습니다.
- Vite 운영 빌드 성공. 런타임 의존성 추가는 없습니다.
- 앨범 연결/해제, 한국어 곡 정보 유지, 외부 장애·분당 제한·캐시, 출처 URL 허용 목록, 비공개 메모 보호를 확인했습니다. CI의 앨범 검색 응답은 외부 장애에 흔들리지 않게 테스트 응답을 사용합니다.
- 홈페이지 설정 충돌, 추천 곡의 공개 여부, 메뉴의 SOOP 주소 공유, 노래·일정 복원, 오래된 편집창 거부, 영구 삭제 확인, 일괄 수정의 부분 충돌을 확인했습니다.
- 두 관리자가 동시에 서로 중지해도 활성 관리자가 0명이 되지 않음을 실제 D1 트랜잭션 테스트로 확인했습니다. 세션 폐기·사용 재개·본인 보호·초기 비밀번호 변경·Origin·CSRF도 확인했습니다.
- JSON 파일을 Vue 반응형 객체에서 직접 복사하며 발생한 오류를 수정했습니다. 공통 대화상자의 접근성 이름을 직접 지정하고 실제 역할로 브라우저 입력을 검증합니다.
- 공개 화면/폼 데이터 처리, 기존 10컬럼 CSV·수입 중복 방지, 일정 이미지 출력 및 참고 UI의 기존 동작을 유지합니다.

## 운영 데이터 보호

- 배포 전 SQL 백업과 격리 복원 완료: .local/backups/verified-20261023213842-97517493, 기존 10개 테이블 무결성 정상. 첫 시도는 Cloudflare OAuth 접근 오류로 실패했고 기존 로그인 갱신 후 완료했습니다.
- 원본 사용자 변경 database/migrations/0001_initial.sql과 사용자 ZIP은 보존하고 커밋 대상에서 제외합니다. 원본 SQL의 SHA-256은 작업 시작 시 기록한 값과 비교합니다.
- 실행 migration 0009/0010만 새로 추가했습니다. 기존 노래/일정 행을 바꾸거나 삭제하는 migration은 없습니다.
- 배포 전 공개 노래와 기본 테마를 .local/operations-review/public-before.json에 기록했습니다.

## 배포 상태

로컬 검증을 마친 소스를 GitHub에 저장하고 원격 migration·배포·운영 검증을 이어갑니다. 완료된 소스/Worker 버전/CI/운영 확인 결과는 이 절에 추가합니다.

## 미연결 기능과 범위

이번 범위의 앨범 검색·설정·복구·일괄 수정·계정 상태 기능은 실제 API와 연결했습니다. 앨범 자동 확정, 고해상도 URL 임의 변환, 음원/가사 다운로드, 커버 파일 업로드, 게시판/CMS, 관리자 권한 등급, SOOP 승인 대기 API는 포함하지 않습니다. JSON 가져오기는 한 곡씩 새 등록을 준비하며 기존 곡을 일괄 덮어쓰지 않습니다. 변경 기록은 전체 버전 복원이 아니고, 주간 이미지 메모의 기존 삭제는 이 휴지통에 포함되지 않습니다.

## 변경 파일

- README.md
- docs/27_OPERATIONS_AND_ALBUMS.md
- docs/28_OPERATIONS_QA.md
- migrations/0009_song_albums.sql
- migrations/0010_operation_recovery.sql
- public/_headers
- public/images/itunes-badge.svg
- server/index.js
- server/repositories/admin-users.js
- server/repositories/appearance.js
- server/repositories/recovery.js
- server/repositories/schedule-events.js
- server/repositories/site-profile.js
- server/repositories/song-imports.js
- server/repositories/songs.js
- server/repositories/versioned-setting.js
- server/routes/admin.js
- server/routes/public.js
- server/routes/recovery.js
- server/routes/schedule-events.js
- server/routes/site-profile.js
- server/routes/songs.js
- server/services/admin-status.js
- server/services/catalog.js
- server/services/csv.js
- server/services/operation-validation.js
- server/services/song-bulk.js
- server/services/song-validation.js
- shared/album.js
- shared/site-profile.js
- shared/song-backup.js
- src/components/AdminSongCollection.vue
- src/components/AlbumPicker.vue
- src/components/AlbumSource.vue
- src/components/Modal.vue
- src/components/SiteSettingsTabs.vue
- src/components/SongBackupImport.vue
- src/components/SongBulkEditor.vue
- src/components/SongCard.vue
- src/components/SongFilters.vue
- src/components/SongManagementActions.vue
- src/components/schedule/ScheduleNav.vue
- src/main.js
- src/pages/AdminHome.vue
- src/pages/AdminRecovery.vue
- src/pages/AdminSite.vue
- src/pages/AdminSongGuide.vue
- src/pages/AdminSongs.vue
- src/pages/AdminUsers.vue
- src/pages/Home.vue
- src/pages/SongEditor.vue
- src/pages/SongGuide.vue
- src/router/index.js
- src/services/admin-navigation.js
- src/services/return-to.js
- src/services/site-profile.js
- src/services/song-adapter.js
- src/services/song-backup.js
- src/services/song-draft.js
- src/services/song-review.js
- src/services/useSiteNavigation.js
- src/styles/operations.css
- src/views/AboutView.vue
- src/views/HomeView.vue
- src/views/SongDetailView.vue
- src/views/SongFormView.vue
- tests/api.test.js
- tests/e2e/list-guide.spec.js
- tests/e2e/navigation.spec.js
- tests/e2e/operations.spec.js
- tests/e2e/prepare.js
- tests/e2e/site.spec.js
- tests/operations.test.js
