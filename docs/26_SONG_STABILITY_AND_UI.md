# 노래 관리 안정성·UI·공통 코드 정리

작업일: 2026-10-18. 운영 주소 https://zio-home.com. HTTPS 자동 전환은 사용자 설정 영역으로 보존합니다.

## 사용자 화면

- 공개/관리자 노래 목록에서 유효 범위를 벗어난 페이지는 검색·필터·정렬을 유지한 마지막 페이지로 보정합니다. 검색 결과 없음과 등록된 노래 없음을 구분합니다.
- PC 1,200px 이상 관리자 노래 관리는 목록을 기본으로 사용하며 목록/카드 선택을 브라우저에 보관합니다. 작은 화면은 카드로 전환합니다. 보기 변경은 추가 API 조회를 만들지 않습니다. 목록에는 비공개 메모를 표시하지 않습니다.
- 등록·수정 저장 버튼 옆에서 공개 여부와 메모 보호 안내를 즉시 확인합니다. 두 화면은 같은 폼·검증을 사용합니다.
- 항목 옆 ?는 마우스 올림, 키보드 초점, 모바일 탭으로 열며 Esc/외부 클릭/다시 탭으로 닫습니다. 작은 화면 안에 위치를 보정하고 입력을 바꾸거나 저장하지 않습니다.
- CSV 실패 재시도/창 다시 열기는 완료 작업을 확인해 중복 삽입하지 않습니다. 미리보기 이후 중복 상태가 바뀌면 새 안내와 동의를 받습니다. 실제 새 작업의 명시적 중복 추가는 유지합니다.
- 관리자 등록·관리 가이드에 새 사용법을 반영합니다. 공개 메모 차단·로그인·권한·버전 충돌 검사·실제 API는 유지합니다.

## 코드 책임

| 위치 | 책임 |
| --- | --- |
| shared/song-rules.js | 입력 길이·숙련도·연습 상태·CSV 필드 계약 |
| shared/song-list.js / src/services/useSongs.js | 빈 화면 문구와 공통 페이지 보정 |
| src/services/useSongLayout.js | PC 보기 선택과 화면 크기 처리 |
| src/components/AdminSongCollection.vue / SongManagementActions.vue | 목록·카드에서 같은 관리 버튼 사용 |
| src/components/FieldLabel.vue / HelpTooltip.vue / SongSaveVisibility.vue | 입력 도움말과 저장 공개 안내 |
| src/services/song-form-info.js | 노래 항목별 도움말 |
| src/services/useCsvImport.js / csv-import-task.js | 가져오기 상태와 탭·계정·파일별 작업 키 |
| server/services/csv.js | CSV 해석·검증·미리보기·내보내기 |
| server/services/song-imports.js | 작업 재전송·중복 미리보기 계약 |
| server/repositories/song-imports.js | DB 스냅샷 조건·시도별 claim·원자적 INSERT |
| scripts/backup-verify.js | SQL 내보내기와 분리된 로컬 복구 검증 |

CSS는 6개 완전 중복 규칙을 제거하고 공통 입력/초안 규칙을 controls.css로 이동했습니다. schedule.css는 ScheduleNav에서 일정 화면에만 불러옵니다. 노래 관리와 폼 스타일은 각 기능에서 불러옵니다. 기존 캐스케이드 순서를 유지하며 전체 재설계는 하지 않았습니다. 초기 CSS는 약 99.21KB에서 70.07KB로 줄고 필요한 기능 스타일은 해당 화면에서 받습니다.

## 데이터·배포 주의

실행 migrations/0008_song_import_jobs.sql과 설계 사본 database/migrations/0008_song_import_jobs.sql을 추가합니다. 기존 테이블은 변경하지 않습니다. 영수증은 관리자별 작업 키·본문 해시·시도 토큰·결과만 보관합니다. 추가 유료 자원·외부 서비스·정기 폴링은 없습니다. 이전 브라우저 화면은 배포 후 새로고침합니다.

시작 시 사용자 변경인 database/migrations/0001_initial.sql과 미추적 UI ZIP을 기록했으며 수정·스테이징하지 않습니다. 전체 변경 파일 목록은 이 릴리스 커밋으로 확인할 수 있습니다. 백업과 화면 검증 기록은 Git 제외 .local/stability-review 및 .local/backups 아래 보관합니다.

## 검증과 운영 반영

전체 단위·API·실제 브라우저·참고 UI 검증, 다섯 기준 크기(1920×1080, 1440×900, 768×1024, 390×844, 360×800), CSV 동시 재시도·응답 유실·부분 실패 롤백·미리보기 변경, SQL 백업 복구를 확인한 뒤 배포합니다. 최종 결과와 배포 버전은 아래에 기록합니다.

## 추가 공통화

DeleteConfirmation을 노래·개별 일정·주간 메모가 공유합니다. 기능별 대상 설명·백업·삭제 API·버전 검사는 각 기능에 남깁니다. 개별 일정은 삭제 전 대상을 보여주는 확인창을 추가하고 취소·Esc는 삭제 요청을 보내지 않습니다. 새로고침·탭 닫기·미저장 이동의 브라우저 확인은 유지합니다.

GuideDetails는 CSV 열과 백업의 고급 설명을 접습니다. 실패 대응은 기본 안내로 남깁니다. single-flight는 동시에 실행 중인 로그인 상태 조회만 공유하고 결과를 캐시하지 않으므로 다음 관리 화면 이동은 다시 인증을 확인합니다. 서버의 매 요청 인증·권한·CSRF 검사는 유지합니다.

.github/workflows/verify.yml은 push/PR의 읽기 전용 검증을 추가합니다. Windows / Node 24.11.1 / Chromium으로 단위·API·격리 브라우저·참고 UI·빌드를 실행합니다. Cloudflare 자격 증명·운영 DB·자동 배포는 사용하지 않으며 비공개 테스트 자료를 아티팩트로 업로드하지 않습니다. GitHub 공식 checkout/setup-node 릴리스 커밋을 고정했습니다([checkout](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0)).

README는 현재 주소·메뉴·실행법을 우선 배치하고 과거 내용은 docs/RELEASE_HISTORY.md로 보존했습니다. 실제 곡·앨범 자료와 SOOP 승인 정보는 제공되지 않아 임의로 등록하거나 연결하지 않았습니다. 공유 OG 이미지·반복 일정·휴지통·개발 도구 버전 업은 이전 분석의 후속 범위로 남깁니다.

## 최종 로컬 검증

단위·API 109개, 실제 브라우저 72개, 참고 UI 6개, 총 187개 고유 항목이 통과했습니다. 첫 검사에서 발견한 예전 카드/페이지 전제의 테스트 2개는 현재 동작에 맞추고, 자정 검사는 로딩 중 시간이 경계를 넘지 않도록 검증용 시계를 고정했습니다. 수정 뒤 전체 브라우저 검사를 다시 실행했습니다.

운영 D1 SQL 백업을 새 로컬 공간에 복구하여 9개 사용자 테이블과 관련 스키마 개체·행 수 일치, quick_check 정상·foreign_key_check 0건을 확인했습니다. 운영 데이터 쓰기 0건이며 SQL/복구 상태/검증 기록은 Git 제외 비공개 폴더에 보관합니다.

### 변경 파일

- .github/workflows/verify.yml
- README.md
- database/migrations/0008_song_import_jobs.sql
- docs/03_API.md
- docs/07_OPERATIONS.md
- docs/26_SONG_STABILITY_AND_UI.md
- docs/RELEASE_HISTORY.md
- migrations/0008_song_import_jobs.sql
- package.json
- playwright.config.js
- playwright.ui.config.js
- scripts/backup-verify.js
- server/repositories/song-imports.js
- server/routes/admin.js
- server/routes/songs.js
- server/services/csv.js
- server/services/song-imports.js
- server/services/song-validation.js
- shared/song-list.js
- shared/song-rules.js
- src/components/AdminSongCollection.vue
- src/components/CsvImport.vue
- src/components/DeleteConfirmation.vue
- src/components/FieldLabel.vue
- src/components/HelpTooltip.vue
- src/components/Icon.vue
- src/components/SongManagementActions.vue
- src/components/SongSaveVisibility.vue
- src/components/guide/GuideDetails.vue
- src/components/schedule/ScheduleEventDialog.vue
- src/components/schedule/ScheduleNav.vue
- src/components/schedule/ScheduleWeekDelete.vue
- src/main.js
- src/pages/AdminSongGuide.vue
- src/pages/AdminSongs.vue
- src/pages/Songs.vue
- src/services/api.js
- src/services/csv-import-task.js
- src/services/single-flight.js
- src/services/song-adapter.js
- src/services/song-form-info.js
- src/services/song-labels.js
- src/services/useCsvImport.js
- src/services/useSongLayout.js
- src/services/useSongs.js
- src/styles/controls.css
- src/styles/integration.css
- src/styles/main.css
- src/styles/schedule.css
- src/styles/song-editor.css
- src/styles/song-management.css
- src/views/SongFormView.vue
- tests/api.test.js
- tests/e2e/events.spec.js
- tests/e2e/integration.spec.js
- tests/e2e/prepare.js
- tests/e2e/recovery.spec.js
- tests/e2e/schedule-pagination.spec.js
- tests/e2e/site.spec.js
- tests/e2e/song-conflicts.spec.js
- tests/e2e/song-guides.spec.js
- tests/e2e/song-stability.spec.js
- tests/e2e/support/admin.js
- tests/session-check.test.js
- tests/stability.test.js
- tests/ui/preview.spec.js


## 운영 반영 완료 (2026-10-18)

- 배포 소스: d8c96edb33dfe9f6cb0b25fa09401d7439ab9810. Worker: 1e99891b-b437-4262-934f-9670280e0027. 대표 주소 https://zio-home.com, 기존 workers.dev 주소도 같은 HTML을 반환합니다.
- 실행 migration 0008을 적용했고 운영의 song_import_jobs 테이블 생성·0건 상태를 확인했습니다. 기존 노래·계정·일정은 보존했습니다.
- 로컬 단위·API 109개, 브라우저 72개, 참고 UI 6개로 187개 고유 항목을 검증했습니다. 전체 실행 뒤 확인창 변경 검사와 테스트 서버 연결 오류를 보완하고 관련 9개를 재검증했습니다. 읽기 전용 테스트 요청만 ECONNRESET에 최대 2회 재시도하며 실제 변경 요청/앱 코드는 자동 재시도하지 않습니다.
- [GitHub 독립 환경의 전체 검증](https://github.com/gamsung0388/zio_page/actions/runs/39103784318)도 단위·API·전체 브라우저·참고 UI·프로덕션 빌드 모두 성공했습니다. 로컬은 Edge, GitHub는 Chromium입니다.
- 배포 직전 SQL 백업 및 격리 로컬 복구를 다시 검증했습니다. 9개 사용자 테이블의 관련 스키마 개체·행 수 일치, 무결성 정상, 외래 키 문제 0건입니다. 비공개 백업은 .local/backups/verified-20261018152128-47322ab6에 보관합니다.
- 운영 파일 80개의 SHA-256이 로컬 빌드와 일치합니다. DB ready, 익명 관리자 API 401, 관리자 가이드의 로그인 이동을 확인했습니다. 다섯 기준 화면 크기의 목록/카드·툴팁·저장 공개 안내·가이드 왕복·새 탭 입력 유지·가로 넘침 없음을 확인했습니다. 앱 실행 오류 0, Vue 경고 0, 앱 자체 CSP 위반 0입니다.
- 운영 시각 검증의 관리자 GET만 브라우저에서 임시 응답했고 모든 운영 쓰기 요청을 차단했습니다. 실제 로그인·저장·수정·삭제·CSV는 격리 D1과 GitHub에서 검증했습니다. 제품에는 모의 서비스를 연결하지 않았습니다. 이번 범위의 미연결 UI는 없습니다.
- 보호된 사용자 SQL의 시작 해시를 재확인했고 원래 SQL 변경과 UI ZIP을 Git에서 제외했습니다. 초기 공통 CSS는 70.07KB / gzip 15.90KB, 일정 CSS는 지연 로드 29.16KB / gzip 5.80KB입니다.

### Cloudflare 별도 설정 관측

대표 HTTPS의 인증서와 서비스는 정상입니다. 사용자께서 자동 전환 완료를 알려주셨으나 이번 외부 검사에서는 http://zio-home.com/admin/songs/guide?check=1 이 HTTP 200 / Location 없음으로 관측됐습니다. HTTPS 자동 전환을 성공으로 기록하지 않았으며 계정의 SSL 설정은 이번 코드 배포에서 변경하지 않았습니다.

Cloudflare 자동 방문 통계 스크립트가 기존 script-src self 정책에 차단되는 경고 10건을 앱 오류와 구분해 기록했습니다. 통계 자동 삽입/보안 헤더는 유지했습니다. 이전 분석의 후속 설정 항목이며 노래·일정 기능의 실패는 아닙니다. HTTPS 전환 상태와 통계 사용 여부는 Cloudflare 영역에서 별도로 확인할 대상입니다.
