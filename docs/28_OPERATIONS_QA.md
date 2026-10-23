# 운영 기능·앨범 연결 검증 기록

2026-10-23. [사용법과 설계](27_OPERATIONS_AND_ALBUMS.md).

## 로컬 검증

- 단위/Miniflare·D1 API 132개, 전체 브라우저 회귀 89개, 참고 UI 6개 통과. 고유 테스트 총 227개입니다.
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

## 운영 앨범 검색 오류 수정

사용자가 운영 검색의 연결 오류를 제보했습니다. Workers는 redirect:error를 지원하지 않아 외부 요청을 보내기 전에 TypeError를 발생시켰습니다. 최초 Node 서비스 단위 검증과 브라우저의 검색 응답 대체만으로는 이 차이를 잡지 못했습니다. redirect:manual로 수정하고 응답 상태를 검사합니다. Miniflare의 실제 workerd 전역 fetch와 외부 응답 모의 연결을 사용하는 API 테스트를 추가해 요청 생성, 한국 검색의 빈 결과, 미국 검색의 후보 및 리다이렉트 거부를 검증합니다. 근거: https://developers.cloudflare.com/workers/runtime-apis/request/ .

## 새 스키마 백업 검증 보완

D1의 원본 내보내기는 테이블 생성 직후 그 테이블의 데이터를 넣습니다. 새 songs.updated_by가 뒤에 나오는 admin_users를 참조해 격리 복원에서 부모 테이블이 아직 없다는 오류를 발견했습니다. 운영 데이터에는 영향이 없었습니다. 백업 도구는 원본 SQL을 그대로 보존하고, 원본 SQL에서 문자열·주석을 보존하며 테이블 DDL만 먼저 격리 DB에 생성하고 나머지 원본 구문을 그대로 실행하도록 보완했습니다. 이력 트리거와 인덱스는 원본의 데이터 뒤에서 생성되어 복원 중 중복 이력을 만들지 않습니다. 세미콜론·줄바꿈·따옴표가 든 메모 보존과 실제 외래키·트리거를 SQLite에서 검증합니다.

## 배포 상태

운영 기능과 백업 복구 보완 소스 12fa2693c144b964d8cf07ca1450cb606e432412는 GitHub에 저장하고 Worker cb182ab1-2757-4894-b078-903eca831332로 배포했습니다. [GitHub 전체 검증](https://github.com/gamsung0388/zio_page/actions/runs/39959598897)은 성공했습니다. 별도 운영 SQL 백업 verified-20261023220718-c0d8c587은 13개 테이블 격리 복원과 무결성을 통과했습니다. 이후 실제 Cloudflare 공유 IP에서 Apple HTTP 429를 확인해 외부 검색을 중지하고 직접 사진 등록으로 보완했습니다. 최신 동작과 배포 결과는 [사진 등록 기록](29_MANUAL_SONG_COVERS.md)을 따릅니다.

## 미연결 기능과 범위

설정·복구·일괄 수정·계정 상태 기능은 실제 API와 연결했습니다. 외부 앨범 검색·새 연결은 일시 중지하고 직접 사진 등록을 제공합니다. 앨범 자동 확정, 고해상도 URL 임의 변환, 음원/가사 다운로드, 원본 사진 보관, 게시판/CMS, 관리자 권한 등급, SOOP 승인 대기 API는 포함하지 않습니다. JSON 가져오기는 한 곡씩 새 등록을 준비하며 기존 곡을 일괄 덮어쓰지 않습니다. 변경 기록은 전체 버전 복원이 아니고, 주간 이미지 메모의 기존 삭제는 이 휴지통에 포함되지 않습니다.

## 변경 파일

- README.md
- docs/27_OPERATIONS_AND_ALBUMS.md
- docs/28_OPERATIONS_QA.md
- migrations/0009_song_albums.sql
- migrations/0010_operation_recovery.sql
- public/_headers
- public/images/itunes-badge.svg
- scripts/backup-schema.js
- scripts/backup-verify.js
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
- tests/backup-schema.test.js
- tests/e2e/list-guide.spec.js
- tests/e2e/navigation.spec.js
- tests/e2e/operations.spec.js
- tests/e2e/prepare.js
- tests/e2e/site.spec.js
- tests/operations.test.js
