# 02. 시스템 아키텍처 및 프로젝트 구조

## 기술 선택
- Vue 3 + JavaScript + Vite + Vue Router.
- Cloudflare Workers + Workers Static Assets: 같은 오리진의 `/api/*`와 SPA 제공.
- Cloudflare D1: 노래/관리자/세션 저장. SQLite 기능에 맞춰 쿼리 작성.
- Worker 내부 계층을 Route → Service → Repository로 분리해 Java/Spring 계층과 대응.
- 내장 DB·호스팅을 사용해 무료 범위 내 월 $0를 **목표**로 한다. 초과 트래픽/정책 변경 및 커스텀 도메인은 별도.

## 추천 프로젝트 디렉터리
```
E:\zio
├─ src/                 # Vue SPA
│  ├─ pages/             # Home, Songs, SongDetail, AdminLogin, AdminSongs
│  ├─ components/
│  ├─ router/
│  ├─ services/          # 브라우저 API 클라이언트
│  └─ styles/
├─ server/              # Worker API
│  ├─ index.js
│  ├─ routes/
│  ├─ services/
│  ├─ repositories/
│  ├─ middleware/
│  └─ utils/
├─ migrations/          # Wrangler D1 migrations 실행용
├─ database/            # 데이터 모델 참고 원본
├─ docs/
├─ tests/
├─ public/
├─ wrangler.jsonc
└─ package.json
```
`database/migrations/0001_initial.sql`을 초기 참고 스키마로 사용하고 Wrangler 실행 마이그레이션 위치를 `migrations/`로 통일한다. 두 위치 간 실수로 이중 적용하지 않도록 복사/이동 방식을 문서화한다.

## 라우팅
- SPA: `/`, `/songs`, `/songs/:id`, `/admin/login`, `/admin/songs`.
- API: `/api/*`는 항상 Worker로 전달. SPA fallback은 `single-page-application`.
- Cloudflare 공식 Vue+Workers 템플릿 또는 Cloudflare Vite 플러그인으로 설정하는 것을 우선한다. 템플릿의 현재 Wrangler 키와 상충하는 경우 공식 템플릿 우선.

## 데이터 접근
- 공개 요청 → Worker public route → 공개 조건 `is_public=1` → D1.
- 관리자 요청 → 세션 검사 → 관리자 route → service 검증 → Repository prepared statement → D1.
- 페이징 LIMIT 상한과 SQL 인덱스로 불필요한 전체 스캔 방지.
- 미래 모듈의 추가 테이블/라우터는 기존 songs 모듈과 독립적으로 추가.

## 캐시
관리자/인증 API: `Cache-Control: no-store`. 공개 목록은 초기에는 보수적으로 캐시 없음 또는 짧은 수명; 수정 즉시 반영되어야 함. HTML/정적 해시 파일은 플랫폼 기본 캐시 이용.

## 소스 및 환경 관리
`.dev.vars`, `.env.local`, API 토큰, 관리자 암호/해시는 버전 관리 제외. CI나 배포 시 비밀값은 Cloudflare Secrets 사용. D1 데이터는 Git에 넣지 않고 schema/migrations만 추적.
