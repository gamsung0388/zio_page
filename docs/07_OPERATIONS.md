# 07. 실행 및 배포 운영

## 로컬

README 명령으로 설치·마이그레이션·계정 생성을 완료합니다. Vite 플러그인과 Wrangler는 동일한 `.wrangler/state/v3/d1` 저장소를 사용하므로 프로세스를 다시 실행해도 노래가 유지됩니다. `.wrangler`를 삭제하면 로컬 데이터도 삭제됩니다. 원격 데이터와는 완전히 별개입니다.

Worker만 확인하려면 `GET /api/health`, 실제 DB 마이그레이션 상태까지 확인하려면 `GET /api/health?db=1`을 호출합니다. 기본 health는 D1을 읽지 않습니다. 저장소 오류/무료 한도 오류는 세부 SQL을 노출하지 않는 503으로 처리하고 화면에 재시도 안내를 표시합니다.

## 운영자 수동 설정 순서

현재 계정 인증과 실제 D1 생성·연결, 원격 migration 0001·0002·0003 적용까지 완료했습니다. 아래 전체 절차는 새 환경을 위한 참고입니다. 운영자가 원격 관리자 계정을 생성하고 배포까지 완료했습니다. 서비스 주소: https://zio-home.ryan9320.workers.dev. 아래 명령은 신규 설정이나 재배포 시 참고합니다.

```powershell
Set-Location E:\zio
npx wrangler login
npx wrangler d1 create zio-home-db
```

명령이 반환한 **실제 database_id**를 `wrangler.jsonc`의 `d1_databases[0]`에 추가합니다. 기존 binding/name/migrations_dir를 보존합니다. 계정 ID나 토큰을 프론트엔드에 넣지 않습니다.

```powershell
npm run db:migrate:remote
npm run admin:create -- --remote
npm test
npm run build
npm run deploy
```

원격 관리자 계정은 로컬과 별도로 생성해야 합니다. 화면에 표시되지 않는 비밀번호를 운영자가 지정합니다. 배포 전 `APP_ENV=production`과 실제 ID를 검사하며, 서버에서 사용하는 API 토큰이 필요해지면 `npx wrangler secret put 이름`으로 설정합니다. 현재 세션 방식에는 고정 서명 키가 필요 없습니다.

`workers.dev` 기본 도메인으로 시작하며, 별도 커스텀 도메인은 필수가 아닙니다. 배포 후 HTTPS에서 로그인/로그아웃, 쿠키의 Secure/HttpOnly/SameSite, 공개/비공개 분리, CSV를 다시 확인합니다. 실사용 콘텐츠는 지오의 동의와 권리가 확인된 자료만 등록합니다.

## 무료 플랜을 위한 구조

- 정적 HTML/JS/CSS/중립 SVG는 Workers Static Assets가 처리합니다. `run_worker_first`는 `/api`와 `/api/*`만 대상으로 해서 화면 탐색이 Worker 요청으로 불필요하게 집계되지 않게 합니다. API 경로는 SPA HTML로 바뀌지 않습니다.
- D1 하나와 Worker 하나를 사용합니다. KV, R2, Durable Objects, 외부 유료 서비스, Cron, 이미지/방송 API를 추가하지 않습니다.
- 공개 목록은 항목/총계 2개 SQL, 최초 옵션 조회 시 3개 SQL입니다. 관리자 목록은 세션 조회가 1개 추가됩니다. 한 곡 상세는 1개 SQL입니다.
- 홈은 최근 5곡만 조회하고, 검색은 디바운스 및 취소를 지원합니다. 목록 기본 20/최대 100곡이며 정렬과 공개/상태에 인덱스를 둡니다. 페이지 이동에도 전체 레코드를 프론트로 내려받지 않습니다.
- 정확한 변경 반영과 메모 보호를 위해 API는 no-store입니다. 부분 문자열 검색과 COUNT는 데이터 크기에 따라 읽기량이 증가하므로 대규모 성장 시 실제 쿼리 통계에 따라 FTS/카운트 전략을 재검토합니다.
- CSV 1,000곡은 인증/중복검사/10개 INSERT로 처리합니다. D1 요청당 쿼리 수와 바인딩 수에 맞춥니다.
- Cloudflare 무료 할당량과 CPU/DB 사용량을 Dashboard에서 확인합니다. 무료 범위 내 월 0원을 목표로 하지만 무제한/비용 보장은 아닙니다. 최신 기준은 [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)를 확인하세요. 자동 유료 전환이나 유료 리소스 생성은 구현하지 않았습니다.

## 백업 및 복구

관리 UI의 CSV 백업은 메모를 포함합니다. 공유 폴더에 두지 말고 접근을 제한합니다. CSV 수식 방어 접두사는 원문과 다를 수 있으므로, 전체 DB의 정확한 복구에는 SQL 백업을 사용합니다.

```powershell
New-Item -ItemType Directory -Path backups -Force
npx wrangler d1 export zio-home-db --remote --output backups/zio-home.sql
```

SQL에는 관리자 비밀번호 해시와 세션도 포함되므로 민감한 백업으로 취급합니다. 대량 데이터에서도 Wrangler export를 사용합니다. CSV 앱 내 내보내기는 일반적인 소규모 노래책자용입니다.

복구 SQL은 기존 테이블과 충돌할 수 있습니다. 먼저 별도 D1에 복구를 시험하고, 대상/백업을 확인한 운영자가 원격 `wrangler d1 execute ... --file ...`을 수행합니다. 운영 DB 전체를 지우는 자동 복구 명령은 제공하지 않습니다. 이미 실행된 migration은 수정하지 않습니다.

관리자 강제 로그아웃:

```powershell
npm run admin:revoke -- --remote
```

표시된 ID의 모든 세션을 삭제합니다. 계정 비활성화(`admin_users.is_active=0`)도 이후 모든 인증을 거부합니다. 비밀번호는 관리 화면의 **비밀번호 변경**에서 교체하며, 다른 관리자 계정은 **관리자 관리**에서 초기화합니다. 두 경우 모두 대상 계정의 기존 세션을 전부 폐기합니다. 초기화 이후에는 새 비밀번호 설정을 강제합니다. 자세한 동작은 [관리자 계정 관리](09_ADMIN_ACCOUNTS.md)를 참고하세요.

## Git / GitHub

원격 저장소는 `https://github.com/gamsung0388/zio_page.git`, 작업 브랜치는 `codex/phase1`입니다. Git 초기화 후 `.gitignore`를 유지하고 `git status --short`에서 `.dev.vars`, `.wrangler`, `.local`, 백업이 추적되지 않는지 확인하세요. 이후 변경사항은 테스트 후 같은 브랜치에 commit/push합니다. 2026-10-16 사용자 승인 후 소스·설계 문서 업로드를 완료했습니다. Cloudflare 자동 배포 연결은 설정하지 않았습니다. 비밀값이나 로컬 DB를 커밋하지 않습니다.

## 자동 D1 설정 시 주의

이 프로젝트는 `env.DB`를 사용합니다. Wrangler가 생성하는 기본 이름 `zio_home_db`를 중복 추가하지 말고 기존 `binding: "DB"` 항목에 실제 database_id를 연결합니다. `remote: false`는 로컬 개발 시 운영 DB를 직접 쓰지 않는 설정이며, 실제 배포와 `--remote` 명령은 연결된 원격 D1을 사용합니다. E2E는 `remote: true` 바인딩이 있으면 시작을 중단합니다.

관리자 비밀번호는 12~256자를 두 번 입력하며 `*`로 표시됩니다. 길이가 짧거나 확인 값이 다르면 해당 입력에서 이유를 표시하고 재입력할 수 있습니다.
