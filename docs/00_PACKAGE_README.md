# ZIO HOME — Codex 개발 패키지

지오 전용 통합 홈페이지. **1차: 메인 홈 + 노래책자 + 관리자**. **2차: 방송 일정표**. 다른 스트리머 지원은 현재 범위에서 제외.

## 적용 방법 (Windows)
1. ZIP을 풀고 폴더 안의 모든 파일을 `E:\zio`에 복사한다. (`E:` 드라이브 직접 쓰기 권한은 이 대화에 없음)
2. `E:\zio\CODEX_PROMPT.md` 전체를 Codex에 입력한다.
3. Codex가 소스 초기화, DB migration, 로컬 실행을 진행한 후, Cloudflare 계정 연결은 직접 승인한다.
4. `.dev.vars`, 비밀번호, API 토큰은 GitHub에 절대 업로드하지 않는다.

## 파일 안내
- `CODEX_PROMPT.md`: 그대로 복사해 Codex에 전달할 메인 작업 지시서
- `docs/01_PRODUCT.md`: 화면/기능/사용자 흐름/완료조건
- `docs/02_ARCHITECTURE.md`: 스택, 폴더, 확장 규칙
- `docs/03_API.md`: REST API 계약
- `docs/04_SECURITY.md`: 로그인/권한/방어 원칙
- `docs/05_ROADMAP.md`: 작업 순서, 테스트, 배포 및 운영
- `docs/06_PHASE2_SCHEDULE.md`: 2차 일정표 설계(미구현)
- `database/migrations/0001_initial.sql`: D1 1차 스키마
- `templates/songs_import.csv`: CSV 데이터 양식

## 고정 결정
Vue 3 + JavaScript, Vite, Cloudflare Workers + Static Assets, D1, GitHub, Codex. 무료 사용량 안에서 월 $0 목표(보장 아님). API/DB는 같은 Worker 도메인에서 운영.

## 유의
Cloudflare 최신 템플릿/설정이 문서와 다르면 공식 지원 방식 우선. 무료 한도 초과 시 요청 실패 가능. 관리자 계정/세션 비밀키는 직접 설정. 실제 곡 데이터는 임의 생성하지 않는다.
