# 10. UI 확인 단계 통합 기록

> 이 문서는 기능 연결 전 UI 확인 단계의 기록입니다. 이후 사용자 요청에 따른 실제 기능 연결은 [11 UI 통합](11_UI_INTEGRATION.md)을 참조하세요.

검증일: 2026-10-16 (Asia/Seoul). 사용자 요청에 따라 UI 확인 단계까지 진행했으며 새 화면의 실데이터 연결·운영 배포·GitHub 업로드는 수행하지 않았습니다.

## 시작 상태와 보존

- 작업 시작 커밋: `4a64751`, 브랜치 `codex/phase1`.
- UI 데모가 프로젝트 루트에 복사되어 package.json, 앱 진입점, Vite 설정, README 등이 이미 바뀌어 있었습니다. 시작 Git 상태·패치·변경 및 미추적 파일 32개를 아래 폴더에 보관했습니다.
- 보관 경로: `E:\zio\.local\ui-review\before-20261016-1792152945183`.
- 운영 앱의 App/main/index/Vite 구성과 원래 의존성·스크립트를 복구하고, 사용자 UI App은 `src/ui-preview/App.vue`, 데모 README는 `docs/UI_REFERENCE_README.md`로 보존했습니다. 새 의존성 설치나 lockfile 변경은 없습니다.
- `database/migrations/0001_initial.sql` 끝에 있던 사용자 조회문은 수정하거나 실행하지 않았습니다. 실제 실행 migration은 기존 `migrations/`입니다.
- server, migrations, database, Wrangler, lockfile, 실제 라우터·API 클라이언트·목록 서비스 등 보호 대상 27개 파일의 작업 전후 SHA-256이 모두 같습니다.

## 미리보기 실행

```powershell
Set-Location E:\zio
npm run dev:ui
```

미리보기: http://127.0.0.1:5175/ui-preview.html

| 화면 | 미리보기 주소 끝부분 |
|---|---|
| 홈 | `#/` |
| 공개 목록 | `#/songs` |
| 공개 상세 | `#/songs/demo-001` |
| 노래 관리 시안 | `#/manage` |
| 등록 | `#/songs/new` |
| 수정 | `#/songs/demo-001/edit` |

기존 서비스는 `npm run dev`로 실행합니다(5173, 기존 Workers/D1/로그인). 새 UI는 별도 HTML·Vite 설정·CSS를 사용하므로 기존 라우터와 전역 스타일에 섞이지 않습니다. `npm run build`의 운영 번들에는 미리보기 HTML·예시 곡이 포함되지 않는 것을 확인했습니다.

## 변경 파일

- 실행/격리: `package.json`(UI 전용 명령 3개 추가), `vite.ui.config.js`, `ui-preview.html`, `src/ui-preview/main.js`, `src/ui-preview/App.vue`, `src/ui-preview/songService.js`.
- 공통 UI: `src/components/AppSidebar.vue`, `AppHeader.vue`, `SongCard.vue`, `LeafRating.vue`, `StatusPill.vue`, `src/assets/main.css`.
- 화면: `src/views/HomeView.vue`, `SongsView.vue`, `SongDetailView.vue`, `SongFormView.vue`. 참고용 AboutView도 미리보기 안에서만 유지합니다.
- 어댑터/검증: `src/ui-preview/song-adapter.js`, `tests/ui-adapter.test.js`, `playwright.ui.config.js`, `tests/ui/preview.spec.js`.
- 문서: `README.md`, `docs/UI_REFERENCE_README.md`, 이 문서. 사용자 제공 `docs/reference-ui.png`, `docs/UI_SPEC.md`, 이미지·커버·원본 ZIP은 보존했습니다.
- 전체 작업 전후 파일 상태: `.local/ui-review/`의 `git-status.txt`, `tracked-changes.patch`, `final-git-status.txt`. 위 보관 폴더에는 원본 파일 사본도 있습니다.

## UI와 기존 API의 대응

| UI | 기존 API |
|---|---|
| level | proficiency (1~5) |
| practiceStatus | practice_status (not_started / practicing / completed / on_hold) |
| balloonCount | balloon_cost (0 이상 안전 정수) |
| privateMemo | memo (관리자 편집에 명시적으로 요청한 경우만) |
| isPublic | is_public |
| createdAt / updatedAt | created_at / updated_at |

등록과 수정은 같은 SongFormView와 validateDraft를 사용합니다. 곡명/가수 200자, 설명 5000자, 메모 3000자 등 기존 API 한도를 유지하고 언어·공개 여부·잠시 보류 상태를 포함합니다. 숙련도 선택은 연습 상태를 바꾸지 않습니다. 공개 시안에서는 비공개 곡과 메모, 수정·삭제 버튼을 표시하지 않습니다.

## 실행 및 시각 검증

| 검사 | 결과 |
|---|---|
| UI 브라우저 | 6개 통과 (최종 10.9초) |
| 단위·통합·CLI·어댑터 | 36개 통과 |
| 기존 서비스 브라우저 | 8개 통과 |
| UI 빌드 | 성공, `.local/ui-preview-dist/` |
| 기존 Worker·클라이언트 빌드 | 성공, `dist/` |
| 보호 대상 파일 | 27개 SHA-256 일치 |

1920×1080, 1440×900, 768×1024, 390×844, 360×800에서 홈·목록·상세·등록·수정 25개 캡처를 생성하고 가로 넘침·이미지 오류·브라우저 예외를 확인했습니다. 주요 PC·태블릿·모바일 캡처를 직접 열어 검토했고 폼 버튼 겹침, 배너 크롭·대비, 모바일 포커스 복원을 보완했습니다.

UI 검색·빈 결과·동일 폼 등록/수정·숙련도/상태 독립성·비공개 목록/상세 차단·메모 비노출·모바일 메뉴 Tab 순환/Escape/포커스 복귀를 검증했습니다. 이 과정의 `/api/*` 요청은 0건입니다. 예시 변경은 브라우저 메모리에서만 유지되며 새로고침 시 초기화됩니다.

캡처 폴더: `.local/ui-review/screenshots/` (25개). 예: `1440-songs.png`, `1920-home.png`, `390-new.png`, `768-edit.png`, `360-detail.png`.

## 확인 후 연결할 기능과 주의점

1. UI 확인을 받은 뒤 기존 GET 목록/상세에 어댑터를 적용합니다. 실제 공개 응답은 기존 서버처럼 memo를 SELECT하지 않는 정책을 유지합니다.
2. 실제 session/라우터 가드를 사용해 편집 UI를 제한하고 기존 POST/PATCH/DELETE·Origin·CSRF 검증을 연결합니다. UI 미리보기의 역할 표시는 인증 기능이 아닙니다.
3. CSV·페이지네이션·전체 필터 등 기존 서비스 기능은 유지한 채 새 디자인으로 순서대로 옮깁니다. 미리보기의 검색·장르·정렬은 예시 데이터만 대상으로 합니다.
4. cover·links는 현재 D1/API에 없는 시안 필드입니다. 이미지 선택은 3MB 이하 로컬 Data URL 미리보기만 제공하며 영구 업로드나 음원/커버 자동 검색은 연결하지 않았습니다. 저장소·외부 음악 API·링크 검증은 별도로 결정합니다. UI 때문에 D1 스키마를 추가하지 않았습니다.
5. 사용자 확인 전 운영 배포하지 않습니다. 방송 일정·다른 스트리머 기능도 구현하거나 연결하지 않았습니다.
