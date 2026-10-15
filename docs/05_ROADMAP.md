# 05. 개발 로드맵, 검증, 운영 절차

## 1차 마일스톤
M0 프로젝트 초기화: Cloudflare 공식 Vue 템플릿, Vue Router, Workers API, Wrangler config, Git ignore.
M1 D1: DB 생성/바인딩, SQL migration, 로컬 DB 적용, repository 단위 확인.
M2 공개 영역: 홈, 노래 목록/상세, 검색·정렬·필터·페이징, 빈 상태/에러.
M3 관리자 보안: 초기 계정 CLI, 로그인, 세션 검증, 로그아웃, 무권한 방어.
M4 관리자 CRUD: 등록/수정/삭제/공개, 유효성 검사, 메시지.
M5 CSV: 업로드 미리보기/검증/append, 전체 내보내기.
M6 QA/배포: 화면 크기 테스트, 빌드, 테스트, D1 원격 migration, workers.dev 공개.

## 테스트 시나리오
- 검색어/필터/정렬 동시 사용. 빈 결과.
- 숙련도 1↔5와 연습 상태를 각각 별도로 변경.
- 비공개 곡은 공개 목록/상세에서 표시되지 않으며 404.
- 로그인하지 않은 POST/PATCH/DELETE는 401, 일반 사용자가 비밀값을 알 수 없음.
- 변경/삭제 요청 시 origin check 통과/실패 케이스.
- 대량 검색/페이지 넘김에서 쿼리 횟수 및 읽기 행 확인.
- CSV 인코딩/BOM/쉼표 포함 필드/중복/잘못된 숫자/대량 파일/수식 문자열.
- 모바일 360/390/768/데스크톱, 키보드 내비게이션.
- 관리자 세션 만료 후 다시 로그인 요구.

## 실행 작업 (Codex가 작성·검증)
- Cloudflare 공식 Vue 템플릿 사용: `npm create cloudflare@latest -- zio --framework=vue` (기존 폴더라면 덮어쓰지 않도록 위치 조정)
- 개발 의존성 설치 및 `npm run dev`, `npm run build` 검증.
- D1: `npx wrangler d1 create zio-home-db` 실행 후 반환한 `database_id`를 `wrangler.jsonc` 바인딩에 설정. 실제 ID는 사용자 계정에서 발급되므로 문서에 예시 값을 넣지 않음.
- D1: migration을 `migrations/`에 저장한 뒤 `npx wrangler d1 migrations apply zio-home-db --local` 및 최종 승인 후 `--remote`.
- 배포: 인증 후 `npm run deploy` 또는 생성 템플릿이 제공하는 공식 배포 명령.
- `.dev.vars` 로컬 값과 Cloudflare Secret 분리, GitHub push 전 `git status`/secret scan.

## 운영 체크리스트
- 운영자 동의 및 콘텐츠 권리 확인.
- Cloudflare 계정 소유자/복구 절차 설정.
- DB migration과 원격 데이터 백업 확보.
- 본번 관리자 인증/쿠키/HTTPS 확인.
- 사용자 화면의 데이터 갱신 검증.
- Cloudflare 사용량 경고/대응 계획 마련.
- 방문량 증가 또는 이미지 업로드를 도입할 때만 추가 유료 리소스 재검토.

## 배포 비용 전략
기본 workers.dev 도메인으로 시작; Cloudflare Workers/D1 무료 한도 사용; 외부 이미지 저장·동영상·실시간 기능 미도입. 무료 할당량 초과 시 API 오류 가능. 무료 운영은 계획 목표이지 SLA/비용 무조건 보장은 아니다.
