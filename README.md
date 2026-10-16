# ZIO HOME

지오 전용 통합 홈페이지 1차 버전. Vue 3 + **JavaScript** + Vite + Cloudflare Workers / Static Assets + D1으로 구현했습니다. 홈, 노래책자, 검색·필터·정렬·상세, 관리자 인증·CRUD, CSV 일괄 추가와 백업을 제공합니다.

공개 방송 일정표, 다른 스트리머, 공지·갤러리, 신청 접수·결제, 방송 API는 구현하지 않았습니다. 실제 곡과 관리자 계정은 기본 생성하지 않습니다.

배포된 서비스: [홈페이지](https://zio-home.ryan9320.workers.dev) · [관리자 로그인](https://zio-home.ryan9320.workers.dev/admin/login)

## Windows에서 실행

Node.js 22.13 이상(권장: 24 LTS)과 npm이 필요합니다. Cloudflare 로그인 없이 로컬 실행할 수 있습니다.

```powershell
Set-Location E:\zio
npm ci
Copy-Item .dev.vars.example .dev.vars   # 이미 있다면 기존 파일을 보존하세요
npm run db:migrate:local
npm run admin:create
npm run dev
```

`http://127.0.0.1:5173`을 엽니다. `admin:create`는 운영자가 지정한 ID/표시 이름과 `*`로 마스킹되는 비밀번호(8~256자)를 받아 **로컬 D1**에 계정을 생성합니다. 기본 비밀번호나 공개 가입 API는 없습니다. 계정을 만들지 않아도 공개 화면은 실행됩니다. 노래는 관리자 로그인 후 직접 등록하거나 CSV로 추가합니다.

이 작업에서 이미 의존성 설치와 로컬 migration을 수행했습니다. `.dev.vars`도 개발 모드로 생성했습니다. 바로 `npm run admin:create`와 `npm run dev`를 실행하면 됩니다.

## 명령

| 명령 | 기능 |
|---|---|
| `npm run dev` | Vite + 실제 workerd 런타임 + 로컬 D1, 5173 포트 |
| `npm run build` | Vue 정적 파일과 Worker 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 로컬 확인 |
| `npm test` | Node 테스트 + Miniflare/workerd/D1 통합 테스트 |
| `npm run test:e2e` | 설치된 Microsoft Edge로 반응형·관리자 브라우저 테스트 |
| `npm run db:migrate:local` | 로컬 DB migration |
| `npm run db:migrate:remote` | 실제 D1 ID 확인 후 원격 migration |
| `npm run admin:create` | 로컬 관리자 생성 |
| `npm run admin:create -- --remote` | 원격 관리자 생성(Cloudflare 인증 필요) |
| `npm run admin:revoke` | 지정한 로컬 관리자의 모든 세션 폐기 |
| `npm run admin:revoke -- --remote` | 지정한 원격 관리자의 모든 세션 폐기 |
| `npm run deploy` | 실제 D1 ID 확인 → 빌드 → Cloudflare 배포 |

E2E는 `.local/e2e/state`에 독립 DB를 사용하고 실행할 때마다 그 **테스트 DB만 초기화**합니다. 임시 관리자 비밀번호는 실행 중 메모리/자식 프로세스 환경에만 보관합니다. 일반 개발 DB(`.wrangler/state`)와 원격 D1은 사용하지 않습니다. Edge가 설치된 Windows를 기준으로 검증했습니다.

## 구성

```text
src/pages/                   홈 / 노래책자 / 상세 / 관리자 로그인 / 관리
src/components/              필터 / 목록 / 편집 dialog / CSV 미리보기
src/services/                동일 출처 API / 세션 / URL 기반 검색 상태
server/routes/               HTTP 엔드포인트
server/services/             인증 / 입력 검증 / CSV 규칙
server/repositories/         D1 prepared statements
server/middleware/           세션 / Origin / CSRF
server/utils/                암호화 / 요청 크기 제한 / 공통 오류
migrations/                  실제 Wrangler 실행 migration
database/migrations/         설계용 SQL 사본
tests/                       단위 / 실제 D1 통합 / 브라우저 테스트
docs/                        원본 설계 및 실행·운영·QA 문서
```

`0001_initial.sql`은 설계 원본을 그대로 실행 migration으로 복사했습니다. `0002_security_and_indexes.sql`은 영속 로그인 제한과 검색·정렬 인덱스를 추가합니다. Wrangler는 **`migrations/`만** 실행합니다. `database/migrations/`를 별도로 적용하지 마세요. 이미 적용된 migration을 수정하지 말고 다음 번호의 파일을 추가합니다.

## 명시적인 구현 결정

- 검색: 곡명·가수 부분 문자열, 영문 대소문자 구분 없음, 320ms 디바운스. `%`와 `_`는 문자 그대로 검색합니다. D1의 LIKE 패턴 길이 제한을 피하기 위해 바인딩된 `instr()`를 사용합니다. 부분 검색은 행을 읽으므로 입력 디바운스와 페이지 상한으로 불필요한 요청을 줄입니다.
- 기본 20곡, 최대 100곡. 모든 정렬은 허용 목록, 필터와 쓰기 값은 바인딩합니다. 알 수 없는 곡 필드는 **거부**합니다. 풍은 0 이상 JavaScript 안전 정수입니다.
- 장르·언어 옵션은 실제 저장된 값이 있을 때 표시합니다. 공개 옵션에도 비공개 곡의 정보는 넣지 않습니다. 옵션은 화면 최초 조회/관리 변경 후만 요청합니다.
- 숙련도 5단계와 연습 상태 4종은 독립값입니다. 풍은 수량 안내만 제공합니다.
- 공개 SQL은 `memo`를 SELECT하지 않으며 `is_public=1`을 강제합니다. 관리자 응답을 포함해 API는 `Cache-Control: no-store`입니다.
- PBKDF2-HMAC-SHA256 100,000회 + 계정별 암호학적 랜덤 salt를 사용합니다. workerd에서 실제 검증했습니다. 패스워드 해시 정책을 강화할 때는 CLI와 검증 코드를 함께 변경하고 배포 런타임/무료 CPU 예산을 다시 확인하세요.
- 세션은 256비트 불투명 난수입니다. DB에는 SHA-256 토큰 해시만 저장합니다. 서명 쿠키를 사용하지 않아 별도 세션 서명 secret은 필요하지 않습니다. 최초 관리자 비밀번호는 CLI에서 설정하며, 이후 관리자 등록·비밀번호 변경·초기화는 인증된 관리 화면에서도 수행합니다.
- 쿠키는 HttpOnly/SameSite=Lax/7일 만료이며 운영에서 Secure입니다. `APP_ENV=development` 또는 `test` + loopback HTTP에서만 로컬용 Secure 예외를 허용합니다. 운영 설정은 production으로 고정합니다.
- 모든 관리 변경에 정확한 동일 출처 Origin/Referer 검사와 세션에서 파생한 CSRF 토큰을 요구합니다. 로그인도 출처 검사를 수행합니다. 와일드카드 CORS를 사용하지 않습니다.
- 로그인 제한은 D1의 원자적 카운터로 유지합니다. IP당 15분에 10회, ID당 20회 실패·진행 중 시도를 제한합니다. 성공 시 해당 요청의 예약만 차감해 정상 로그인은 누적하지 않으며 다른 실패 기록은 유지합니다. IP/ID는 해시로 저장하고 성공/실패 로그에 계정·암호·토큰을 남기지 않습니다. 성공한 로그인 때 만료 세션·제한을 제한된 수량만 정리합니다.
- 사용자가 UI 패키지에 제공한 지오 캐릭터 이미지를 사용합니다. 곡 커버는 자체 기본 일러스트이며 실제 앨범 사진을 수집하지 않습니다.

## CSV

`templates/songs_import.csv` 또는 관리 화면에서 빈 템플릿을 받습니다. 컬럼은 다음과 같습니다(순서 변경 가능, 누락·중복·추가 컬럼은 오류).

```csv
title,artist,description,genre,language,proficiency,practice_status,balloon_cost,memo,is_public
```

- UTF-8 / UTF-8 BOM, CRLF/LF, 따옴표/쉼표/필드 안 줄바꿈 지원. 최대 1MB / 1,000곡.
- `proficiency`: 1~5, `practice_status`: `not_started`, `practicing`, `completed`, `on_hold`, `balloon_cost`: 0 이상 정수.
- `is_public`: `true/false` 또는 `1/0`. 숫자/공개/상태가 빈 값이면 각각 1단계/0풍/공개/미연습을 기본 적용합니다.
- 미리보기와 최종 추가에서 각각 서버가 전체 행을 검증합니다. 오류가 하나라도 있으면 **아무 곡도 저장하지 않습니다**. 오류는 CSV의 실제 시작 행 번호로 표시합니다.
- 같은 제목·가수는 경고하며 추가만 합니다. UI에서 중복 경고 확인이 필요하고 기존 데이터는 덮어쓰지 않습니다. 재등록/재전송도 별도 추가되므로 임포트를 반복하지 마세요.
- 100행씩 JSON을 바인딩해 한 문장으로 INSERT합니다. 최대 10개 INSERT를 D1 `batch()` 트랜잭션으로 실행해 무료 플랜의 요청당 쿼리 제한을 고려했습니다.
- 관리자 백업은 필터와 무관하게 전체 곡·비공개 곡·메모를 포함합니다. 수식 주입 위험이 있는 텍스트에는 작은따옴표를 붙여 내보냅니다. 이 접두사는 재가져오기에 그대로 보존됩니다. **모든 원문을 정확히 보존하는 복구용 백업은 D1 SQL export를 병행**하세요.

## 배포 준비

2026-10-16: 실제 원격 D1을 `DB` 바인딩으로 연결하고 원격 마이그레이션 0001·0002를 적용했습니다. 원격 관리자 계정 생성과 사이트 배포까지 완료했습니다. 서비스: [ZIO HOME](https://zio-home.ryan9320.workers.dev). 계정 인증과 지오의 콘텐츠/공개 동의를 받은 뒤 [운영 안내](docs/07_OPERATIONS.md)를 따르세요. 실제 계정이 발급한 `database_id`가 없으면 `deploy`와 `db:migrate:remote`는 중단됩니다. 가짜 ID를 설정하지 않았습니다.

`.dev.vars`, `.env*` 실값, `.local`, `.wrangler`, 빌드 산출물, 백업, DB 파일은 Git에서 제외합니다. 프론트엔드 `VITE_*`에는 비밀값을 넣지 않습니다. Cloudflare Vite가 미리보기용 `.dev.vars`를 `dist`에 복사할 수 있지만 `dist/client` 외부이며 배포 vars는 `wrangler.jsonc`의 production입니다. Cloudflare의 원격 secret은 `wrangler secret put`으로만 설정하세요.

원본 요구사항: [제품](docs/01_PRODUCT.md), [구조](docs/02_ARCHITECTURE.md), [API](docs/03_API.md), [보안](docs/04_SECURITY.md), [로드맵](docs/05_ROADMAP.md), [2차 설계(미구현)](docs/06_PHASE2_SCHEDULE.md). 기존 개발 패키지 README는 `docs/00_PACKAGE_README.md`에 보존합니다.

공식 구성 참고: [Cloudflare Vue](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/), [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

검증 결과: [1차 QA 보고서](docs/08_QA.md) — 단위·통합 33개, 브라우저 8개, 프로덕션 빌드 통과.

## 관리자 계정 관리

관리자로 로그인하면 사이드 메뉴에 **노래 관리**와 **관리자 관리**를 독립된 메뉴로 표시합니다. **노래 관리** `/admin/songs`에서 곡 등록·수정·삭제와 CSV 가져오기·백업을 수행합니다. 로그인 후 열리는 **관리자 관리 메뉴** `/admin`는 계정 관리 전용이며, **관리자 관리**에서 계정 목록·등록, **관리자 비밀번호 초기화**에서 계정별 초기화, **관리자 비밀번호 변경**에서 본인 비밀번호 변경을 수행합니다. 관리자 등록은 관리자 관리 화면에서만, 초기화 버튼은 초기화 메뉴에서만 표시합니다. 초기화 시 사용자 지정 값 `qwer1234!@#$`로 설정하고 기존 로그인을 모두 해제합니다. 초기 비밀번호로 로그인한 계정은 새 비밀번호를 설정해야 관리 기능을 사용할 수 있습니다. 변경 후에는 새 비밀번호로 다시 로그인합니다.

추가 migration: `0003_admin_password_change.sql`. 운영 DB 백업 후 마이그레이션을 적용하고 배포합니다. 기존 계정과 노래 데이터는 보존합니다. [기능 및 보안 계약](docs/09_ADMIN_ACCOUNTS.md).

## GitHub 저장소

소스 저장소: [gamsung0388/zio_page](https://github.com/gamsung0388/zio_page), 작업 브랜치: `codex/phase1`. 비밀값·로컬 DB·백업·빌드 산출물은 추적하지 않습니다.

2026-10-16: 사용자 승인 후 소스·설계 문서를 GitHub `codex/phase1`에 업로드했습니다. 운영 D1을 Git에서 제외된 `.local/backups/`에 백업하고 migration 0003 및 관리자 등록·비밀번호 변경·초기화 기능 배포를 완료했습니다. 배포 버전은 `dc9372fa-33c8-495f-b94d-d5096f12c9a0`입니다. 원격 DB 연결, 새 화면 파일, 익명 관리자 API 접근 차단을 확인했습니다. Cloudflare 자동 배포 연결은 설정하지 않았으므로 이후 배포는 `npm run deploy`로 수행합니다.


## 새 UI와 실제 기능 연결 (2026-10-16)

사용자의 기능 연결 요청에 따라 기존 앱에 새 UI를 통합했습니다. src/App.vue shell, 홈, 카드 목록·상세, 등록·수정 폼을 실제 API에 연결했습니다. DB 스키마, 인증·세션·CSRF, 기존 CRUD·CSV 계약은 유지합니다. 관리자는 노래 관리와 관리자 계정 관리를 별도 메뉴에서 사용합니다.

- 실제 앱: npm run dev 후 http://127.0.0.1:5173 (기존 로컬 D1). 운영 계정·데이터와 로컬 DB는 별개입니다.
- 노래 등록: /admin/songs/new, 수정: /admin/songs/:id/edit. 같은 폼과 검증을 공유합니다. 목록 검색 조건을 유지하고, 저장 중 중복 전송을 차단하며 오류 시 입력을 유지합니다. 저장하지 않은 변경에는 이동·새로고침 확인이 적용됩니다.
- 목록: 검색, 숙련도·연습 상태·장르·언어 필터, 관리자 공개 여부, 풍 개수 등 정렬, 페이지 이동을 기존 서버 처리로 제공합니다.
- 이미지: 기본 커버, 로딩 실패 시 대체, 지연 로딩, 공통 크기. 이미지 업로드·관련 링크 영구 저장은 현재 DB 계약에 없어 운영 폼에 표시하지 않습니다.
- SOOP 승인 전에는 방송국 링크를 유지하며 자동 방송 상태·신청 처리는 연결하지 않습니다. 방송 일정표는 2차 범위입니다.
- 별도 예시 앱: npm run dev:ui 후 http://127.0.0.1:5175/ui-preview.html. 이 앱만 예시 데이터를 사용하며 서버에 저장하지 않습니다. 운영 빌드에 포함하지 않습니다.

검증: 단위·API 37개, 실제 브라우저 11개, 참고 UI 6개 통과. 1920×1080 / 1440×900 / 768×1024 / 390×844 / 360×800에서 확인했습니다. [이번 통합 기록](docs/11_UI_INTEGRATION.md), [이전 UI 확인 단계 기록](docs/10_UI_REVIEW.md).

### 새 UI 운영 배포 완료

2026-10-16: 사용자 요청으로 새 UI와 실제 기능 연결 변경을 [운영 사이트](https://zio-home.ryan9320.workers.dev)에 배포했습니다. Worker 버전: `e7d8a287-cd5d-4ec6-bb6b-4315e77ead21`. 운영 HTML/자산 일치, D1 연결, 익명 관리자 API 차단, PC·모바일 홈·노래책자·로그인과 보호 경로 이동을 확인했습니다. 기존 계정과 DB 스키마를 유지하며 이번 소스 변경의 GitHub 업로드는 별도로 수행하지 않았습니다. [배포 확인 기록](docs/11_UI_INTEGRATION.md).

## 관리자 일정 달력과 스케줄 이미지

관리자 로그인 후 **일정 관리**에서 **일정 달력**(`/admin/schedule`)과 **스케줄 이미지**(`/admin/schedule/image`)를 사용합니다. 날짜별 내용·시간을 서버에 저장하면 두 화면에서 공유합니다. 홈페이지와 같은 흰색 카드·딥그린 버튼·입력창으로 구성했으며, 기존 스케줄러의 템플릿 8종을 PNG/JPEG 1672×941px 출력에 활용합니다. 이미지는 브라우저에서 생성합니다.

저장하기 전의 변경은 달력에 반영되지 않습니다. 동시 수정 충돌 시 입력을 유지하며 서버에서 다시 불러와야 합니다. 이번 기능은 관리자 전용이며 공개 일정표·SOOP 자동 연동은 포함하지 않습니다.

추가 migration: `0004_admin_schedule_weeks.sql`. 원격 DB 백업 → `npm run db:migrate:remote` → `npm run deploy` 순서로 반영합니다. 기존 관리자·노래 테이블은 변경하지 않습니다. [기능·검증·운영 기록](docs/12_ADMIN_SCHEDULE.md).

2026-10-16: 관리자 일정 달력과 홈페이지 스타일의 스케줄 이미지 편집기를 운영에 배포했습니다. Worker 버전: `9fe1e198-b1c3-4649-b13e-934c2bb9caf2`. 원격 D1 사전 백업과 migration 0004 적용을 마쳤으며 운영 DB 연결·새 자산 일치·관리자 전용 접근을 확인했습니다.

## 편집 안정성과 편의 기능 보완

현재 개선 내역은 [14 수정·검증·배포 기록](docs/14_REMEDIATION_RELEASE.md)을 참조하세요. 관리자 일정·노래 편집 초안은 같은 브라우저 탭의 sessionStorage에 계정/대상별로 최대 24시간 보관하며 재로그인 후 복구할 수 있습니다. 비밀번호와 세션 토큰은 보관하지 않습니다. 자발적 로그아웃 시 해당 계정 초안을 정리합니다. 탭을 닫거나 브라우저가 저장을 제한하면 복구할 수 없으므로 영구 보관은 일정 저장·JSON 백업을 사용하세요.

- 로그인·강제 비밀번호 변경 후 원래 관리 화면과 선택 주로 복귀합니다.
- 이미지 편집기는 PC 입력/미리보기 좌우 배치, 모바일 날짜 입력 우선, 접는 꾸미기와 템플릿 미리보기를 제공합니다.
- 넘치는 글자는 PNG/JPEG 출력을 멈추고 글자 자동 맞춤 또는 내용 수정으로 안내합니다.
- 휴방·미정·전날 복사, 지난주 내용/시간/스타일 선택 복사, 현재 주/전체 일정 JSON 백업과 검증 후 선택 주 가져오기를 제공합니다. 가져오기는 화면만 변경하며 수동 저장 전에는 기존 일정에 반영하지 않습니다.
- JSON은 버전 1, 최대 2,000주·10MB입니다. 전체 백업 API는 인증 후 50주 단위로 조회합니다. 불러올 때 한 주를 선택해 현재 편집 주에 적용합니다.
- 한국 자정·브라우저 복귀 시 오늘 날짜를 갱신하면서 편집 중인 주/월은 유지합니다.

기존 D1 스키마와 세션·CSRF 검사를 유지합니다. 새 유료 서비스·정기 폴링은 추가하지 않았습니다. SOOP 연동은 심사 승인 후 별도 연결 대상입니다.

배포 후 다음 개선 순서는 [15 추가 개선 분석](docs/15_POST_RELEASE_REVIEW.md)에 정리했습니다.

최종 운영 버전: `622f0f2c-c3b1-4b60-93da-a4d7326bbade` · 배포 소스 `34d490e` · 최종 86개 검증 통과. [수정·배포 기록](docs/14_REMEDIATION_RELEASE.md) / [다음 개선 분석](docs/15_POST_RELEASE_REVIEW.md).
