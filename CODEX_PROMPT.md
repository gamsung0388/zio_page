# Codex 메인 구현 지시문 — ZIO HOME

> 추가 범위 승인(2026-10-17): 일정별 등록·수정·삭제, 시간 타입과 기간, 하루 여러 일정은 docs/16_INDIVIDUAL_SCHEDULE_EVENTS.md를 따릅니다. 기존 주간 이미지 메모와 노래·관리자 데이터는 보존합니다.

> 추가 범위 승인(2026-10-16): 사용자가 관리자 전용 달력 및 기존 Zio Schedule Maker의 주간 이미지 기능 통합을 요청했습니다. 해당 범위는 docs/12_ADMIN_SCHEDULE.md를 따릅니다. 아래는 최초 1차 개발 지시를 보존한 내용입니다.

당신은 `E:\zio`에서 새 프로젝트를 구현하는 시니어 풀스택 개발자다. 현재 폴더의 문서들을 **반드시 먼저 전부 읽고** 아래 규칙을 준수한다.

## 목표
지오(ZIO) 전용 통합 홈페이지를 **실제로 로컬 실행 가능한 상태**로 구현한다. 1차 릴리스만 개발: 메인 홈, 공개 노래책자, 관리자 로그인/노래 CRUD, CSV 가져오기·내보내기. 방송 일정표는 **2차 개발 문서만 보존하고 구현하지 않는다**. 다른 스트리머 기능을 추가하지 않는다.

## 기술 스택
Vue 3 + Vite + **JavaScript** (프론트), Cloudflare Workers (필요 시 Worker 엔트리 설정 파일만 TypeScript 허용하되 기본은 JavaScript), Cloudflare D1 (SQLite SQL), Vue Router, Wrangler, GitHub. 가능하면 Cloudflare 공식 Vue 템플릿 및 Vite 플러그인 사용. Workers Static Assets로 프론트와 API를 하나의 프로젝트/도메인으로 배포. 공식 템플릿과 충돌하는 수동 설정을 억지로 적용하지 않는다.

## 실행 규칙
1. `docs/*.md`와 `database/migrations/*.sql`의 계약을 따른다. 불명확한 결정은 안전하고 단순한 기본값을 선택하고 README에 기록한다.
2. 작업을 `계획→구현→검증→문서화` 순서로 진행한다. 절반짜리 화면 목업으로 완료 처리하지 말고, 실제 D1 DB와 연동한다.
3. 계정 로그인/Cloudflare 배포/GitHub 원격 생성처럼 사용자 인증이 필요한 작업은 승인이나 입력을 요청한다. 배포 키나 패스워드를 추측하지 않는다.
4. DB 접근은 반드시 서버 측 Worker에서만 한다. 클라이언트에 D1 바인딩·비밀값을 절대 노출하지 않는다.
5. 관리자 로그인 보안은 `docs/04_SECURITY.md`를 준수한다. 비밀번호 평문/단순 SHA 저장 금지, 세션 토큰 원문 DB 저장 금지, 공개 초기 관리자 가입 API 금지.
6. 검색/필터/정렬 입력은 허용 목록 검증 후 파라미터 바인딩 SQL 사용. SQL 직접 문자열 결합 금지.
7. 빈 상태, 로딩, API 오류, 404, 모바일 UI를 구현한다. 공개 화면에 실제 곡처럼 보이는 가짜 데이터는 넣지 않는다.
8. 2차 일정표/공지/갤러리는 placeholder 네비게이션을 노출할 필요가 없다. 1차 메인 화면에 '추후 준비' 정도의 비활성 안내만 선택적으로 가능하다.
9. 실행용 package scripts (`dev`, `build`, `deploy`, `db:migrate:local`, `db:migrate:remote`, `test`)를 만들고 Windows PowerShell 명령을 README에 적는다.
10. 구현 완료 시 주요 파일 목록, 테스트 실행 결과, 아직 수동 수행해야 할 Cloudflare 설정·비밀값·배포 단계를 보고한다.

## 산출물
- Vue 3 반응형 홈 `/`, 노래책자 `/songs`, 곡 상세 `/songs/:id`, 관리자 `/admin/login`, `/admin/songs`.
- Worker API: `docs/03_API.md`에 정의된 엔드포인트.
- D1 migration 및 로컬/원격 적용 절차, CSV import/export.
- `server/routes`, `server/services`, `server/repositories`, `server/middleware` 계층 구조.
- 인증/권한 통합 테스트, CRUD/검색/CSV 테스트, lint 또는 빌드 검증.
- `.gitignore`, `.dev.vars.example`, `.env.example` (비밀값 없이), 배포 및 운영 문서.

## 개발 순서
(1) 공식 템플릿 확인/프로젝트 생성 → (2) D1 바인딩 + migration → (3) Public API → (4) Vue UI → (5) 관리자 인증 → (6) 관리 CRUD → (7) CSV → (8) 테스트 → (9) 배포 준비.

**지금 바로 파일 현황을 확인하고 1차 MVP 구현을 시작해라.** 기존 소스가 있다면 덮어쓰기 전 차이를 파악하고 사용자 작업물을 보존하라.
