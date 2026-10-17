# 25. 노래책자·노래 등록 가이드

2026-10-17 사용자 요청: 방문자를 위한 노래책자 안내와 관리자 노래 등록·관리 안내를 실제 홈페이지에 추가합니다.

## 화면과 진입 위치

| 이용자 | 화면 | 가이드 진입 |
| --- | --- | --- |
| 누구나 | `/songs/guide` | 노래책자 상단 **사용 가이드** |
| 관리자 | `/admin/songs/guide` | 노래 관리 상단 **등록·관리 가이드** |
| 관리자 | 같은 관리자 가이드 | 새 노래 등록·수정 상단 **등록 가이드**. 입력을 유지하며 새 탭으로 열기 |
| 관리자 | `/admin/schedule/guide` | 기존 일정 관리 상단 **사용 가이드** 유지 |

공개 가이드는 검색·필터·정렬·페이지, 숙련도 5단계, 독립된 연습 상태, 상세 보기와 신청 풍 개수를 설명합니다. 실제 신청·결제 기능이 없다는 점도 설명합니다. 관리자 가이드는 한 곡 등록, 항목별 입력 범위, 공개 여부와 내부 메모, 수정·삭제, CSV 미리보기·검증·중복 추가, 백업·초안·동시 수정 대처를 설명합니다. 운영 폼에 없는 앨범 사진·영상 링크 업로드를 가능한 기능으로 안내하지 않습니다.

## 구성과 권한

- `src/components/guide/GuideLayout.vue`: 두 가이드의 제목·이용 순서·목차·본문 구획·복귀·맨 위 이동 공통 구성. 목차 이동은 해당 제목으로 스크롤과 키보드 포커스를 함께 옮깁니다.
- `src/components/guide/GuideLink.vue`: 기존 화면에서 여는 공통 가이드 버튼. 등록·수정은 새 탭 표시와 `noopener`를 적용합니다.
- `src/styles/guide.css`: `.reading-guide` 안에서만 적용하는 공통 스타일. 가이드 경로에서 지연 로드합니다.
- `src/services/song-guide.js`: 공개 목록 또는 노래 관리/편집 화면으로만 복귀를 허용하고 검색 조건을 유지합니다. 외부 주소·경로 정규화 우회·순환 가이드 주소는 기본 목록으로 바꿉니다.
- `src/pages/SongGuide.vue`, `AdminSongGuide.vue`: 기능별 안내 내용. 숙련도·연습 상태의 공개 명칭은 기존 `song-labels.js`를 재사용합니다.
- 기존 Songs/AdminSongs/SongEditor에 버튼을 연결하고 SongFormView에 가이드 슬롯을 추가합니다. UI 시연용 폼과 실제 저장 동작을 유지합니다.
- 관리자 경로는 기존 `meta.admin` 가드를 사용합니다. `safeReturnTo`에 해당 경로만 추가하여 로그인 후 가이드로 복귀합니다. 사용자 메모·곡 데이터를 가이드에 조회하거나 전달하지 않습니다.

API·D1 스키마·실행 migration·로그인·CRUD·CSV 처리는 변경하지 않습니다. 가이드는 추가 데이터 저장이나 주기적 조회가 없는 정적 안내 화면입니다. 계정 관리·메뉴 관리와 노래 관련 메뉴는 독립된 구성을 유지합니다.

## 도메인과 배포

사용자가 연결한 `zio-home.com`이 기존 `zio-home` production Worker의 Custom Domain임을 Cloudflare 조회로 확인했습니다. 재배포에서 연결이 유지되도록 Wrangler에 해당 도메인을 명시하고 기존 `workers.dev` 주소도 유지합니다. DNS·SSL 설정·요금제는 변경하지 않습니다. HTTP → HTTPS 자동 전환은 Cloudflare 영역 설정으로 별도 관리합니다.

- [노래책자 가이드](https://zio-home.com/songs/guide)
- [관리자 등록·관리 가이드](https://zio-home.com/admin/songs/guide)
- [기존 일정 관리 가이드](https://zio-home.com/admin/schedule/guide)

## 변경 전 보존과 검증

변경 전 HEAD·상태·대상 파일을 `.local/song-guide-review/before.json`과 `before/`에 보관했습니다. 기존 사용자 변경 `database/migrations/0001_initial.sql`과 미추적 UI 참고 ZIP은 작업 대상에서 제외합니다. SQL 원본 SHA-256: `dde91c52f936f82445ea9452f3adc6c95697b06464d785cc652d2856f54ef778`.

검증·배포 결과는 완료 후 아래에 기록합니다.

### 로컬 검증 완료

- `npm run build`: 성공.
- `node --test --test-concurrency=1 tests/song-guide.test.js tests/recovery.test.js tests/ui-adapter.test.js tests/csv.test.js tests/config.test.js`: 19개 통과.
- `npm run test:e2e -- song-guides.spec.js integration.spec.js site.spec.js --grep 'guide|save failure|shared editor|admin login, create/edit|unknown' --output=.local/song-guide-review/e2e`: 브라우저 6개 통과.
- 공개 가이드의 로그인 없는 접근·실제 곡 상세와 경로 충돌 없음, 관리자 가이드의 로그인 복귀, 필터·페이지 복귀, 목차 키보드 포커스, 새 탭에서 입력 유지 및 비공개 데이터 미전달 확인.
- 실제 독립 D1의 기존 노래 등록·수정·비공개 분리·검색/상세·CSV·삭제·로그아웃 및 저장 실패 시 입력 유지도 검증.
- PC 1920×1080·1440×900, 태블릿 768×1024, 모바일 390×844·360×800에서 가이드·관리 버튼·입력창의 가로 넘침 없음, 가이드 조작 영역 44px 이상 확인. 가이드 자체의 API 쓰기 요청 없음.
- 검증 로그·전후 파일·화면은 `.local/song-guide-review/`에 보관하고 Git에 포함하지 않습니다. 원격 운영 데이터는 테스트에서 사용하지 않았습니다.

### 운영 반영 완료

- 확인 시각(UTC): 2026-10-17T10:40:13.142Z. 소스: `47979e1edb3f35f26335d44732291820ed305c29`. Worker: `7e6ceef5-ec50-43c7-b62a-cd49d55e7249`.
- 빌드 성공, 단위 검증 19개·브라우저 검증 6개 = 총 25개 고유 검증 통과.
- `https://zio-home.com`의 배포 파일 76개 SHA-256이 로컬 빌드와 일치합니다. D1 연결 ready, 익명 관리자 노래 API 401, 관리자 가이드 직접 접근 시 로그인 이동 및 복귀 주소를 확인했습니다. 기존 workers.dev 주소도 같은 HTML을 반환합니다.
- 운영 PC 1440×900·모바일 390×844·360×800에서 두 가이드, 목차 이동, 목록 검색 조건 복귀, 등록 안내 새 탭과 입력 유지, 가로 넘침 없음을 확인했습니다. 앱 오류·Vue 경고·앱 자체 CSP 위반은 없습니다.
- 운영에서 저장·변경·삭제 요청 0건. 관리자 시각 검증은 브라우저에서 GET만 임시 응답한 별도 QA 스크립트로 실행했으며, 제품의 실제 API·데이터 처리에는 모의 서비스를 추가하지 않았습니다. 실제 저장 동작은 독립 테스트 D1에서 검증했습니다.
- 운영 원본 데이터와 기존 사용자 SQL 변경·UI ZIP을 보존했습니다. DB migration·새 유료 서비스·상시 폴링은 없습니다.

### 도메인에서 별도로 확인한 사항

새 도메인의 Cloudflare 자동 방문 통계 스크립트(`static.cloudflareinsights.com/beacon.min.js`)가 기존 `script-src 'self'` 정책에 차단됩니다. 새 도메인 브라우저 응답에서 자동 삽입을 확인했고, workers.dev 응답에는 삽입되지 않았습니다. 이 차단은 가이드·노래 등록 기능에는 영향을 주지 않습니다. 최종 검증에서도 이 통계 차단 6건을 앱 오류와 구분하여 기록했습니다. 이번 작업은 보안 헤더나 Cloudflare 통계 설정을 변경하지 않습니다. 방문 통계를 사용할 때에는 자동 삽입 여부와 해당 스크립트의 제한적 허용을 함께 결정하고 검증해야 합니다. [Cloudflare 공식 CSP 안내](https://developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp).

HTTP 자동 전환 관측: 상태 `200`, Location `없음`. HTTPS 인증서를 정상 검증하여 가이드를 확인했습니다. SSL 영역 설정 변경 권한은 개발용 인증에 없어 해당 대시보드 설정은 이번 배포에서 변경하지 않았습니다.

### 변경 파일

- `src/router/index.js`
- `src/services/return-to.js`
- `src/pages/Songs.vue`
- `src/pages/AdminSongs.vue`
- `src/pages/SongEditor.vue`
- `src/views/SongFormView.vue`
- `src/styles/integration.css`
- `tests/recovery.test.js`
- `wrangler.jsonc`
- `README.md`
- `src/components/guide/GuideLayout.vue`
- `src/components/guide/GuideLink.vue`
- `src/services/song-guide.js`
- `src/styles/guide.css`
- `src/pages/SongGuide.vue`
- `src/pages/AdminSongGuide.vue`
- `tests/song-guide.test.js`
- `tests/e2e/song-guides.spec.js`
- `docs/25_SONG_GUIDES.md`
