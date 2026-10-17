# 12. 관리자 일정 달력과 주간 이미지 편집기

> 2026-10-17: 메인 일정 달력은 개별 일정/기간/시각으로 확장했습니다. 기존 날짜별 메모는 /admin/schedule/notes에서 유지합니다. 현재 계약은 [16 개별 일정](16_INDIVIDUAL_SCHEDULE_EVENTS.md)을 참조하세요.

> 아래는 최초 통합 시점의 기록입니다. 초안 복구, 좌우 편집, 글자 맞춤, 복사·JSON 백업은 [14 개선 기록](14_REMEDIATION_RELEASE.md)에 반영했습니다.

검증일: 2026-10-16. 사용자의 관리자 전용 달력·기존 스케줄러 이미지 출력 통합 요청을 반영했습니다. 추가 요청에 따라 편집기 UI는 현재 ZIO HOME의 흰색 카드, 딥그린·라임 버튼, 입력창·탭으로 정리했습니다.

## 사용 흐름

- 로그인 → 사이드바 **일정 관리** → **일정 달력** 또는 **스케줄 이미지**.
- 달력에서 날짜를 눌러 방송 내용(최대 500자)과 시간 안내(최대 40자)를 입력하고 저장합니다. 특정 날짜 비우기는 해당 날짜만 비웁니다.
- **저장하고 이미지 만들기**는 선택 날짜가 포함된 주를 저장하고 편집기로 이동합니다.
- 이미지 편집기는 주 선택, 8개 템플릿, 내용/시간 크기, 색상, 굵게, 정렬, 콜론 제거를 제공합니다. 모바일에서는 **날짜별 내용 입력**을 펼쳐 큰 입력창을 이용할 수 있습니다.
- **서버에 저장**하면 같은 관리자의 다른 기기와 다른 관리자도 저장 내용을 조회할 수 있습니다. **서버에서 다시 불러오기**는 현재 입력을 버리기 전 확인합니다.
- PNG/JPEG는 화면·미리보기 크기와 무관하게 1672×941px입니다. 현재 편집 내용으로 출력하므로 저장 전에도 이미지를 만들 수 있습니다. 달력에 반영하려면 서버 저장이 필요합니다.
- **내용 초기화/전체 초기화**는 현재 초안에 적용되며 서버 저장을 해야 영구 반영됩니다. 이동·새로고침 시 미저장 변경 확인을 제공합니다.

## 원본 재사용

원본: E:/dev/Zio Schedule Maker. 템플릿 8종, 필드 위치·옵션 검증, 정적 텍스트 표시, 넘침 감지, 이미지 로딩 대기, html2canvas 캡처 로직을 읽어 복사했습니다. 원본 폴더에는 쓰기 작업을 하지 않았고 기존 Git 변경도 보존했습니다.

원본의 브라우저 localStorage 저장은 홈페이지의 관리자 인증·D1 저장으로 통합했습니다. 원본 사이트의 기존 브라우저 저장 데이터가 자동 이전되지는 않습니다. 템플릿 배경은 출력 자료로 재사용하고 편집 도구는 홈페이지 스타일로 재구성했습니다. 이미지 하단에 해당 주 날짜 범위를 표시합니다.

## 데이터와 권한

- 전용 테이블 admin_schedule_weeks: week_start(월요일 날짜 PK), payload(JSON), revision, updated_by, updated_at(UTC ISO8601).
- payload: selectedTemplate, scheduleForm(월~일 content/time), editorOptions(contentFontSize/timeFontSize/textColor/bold/align/hideColon).
- 날짜는 한국 기준의 달력 날짜이고 time은 미정·휴방 등의 안내도 지원하는 문자열입니다. 실제 방송 시작/종료 시각이나 UTC 이벤트를 예약하는 기능은 아닙니다. 하루에 내용·시간 안내 한 묶음을 저장하며 내용은 여러 줄을 지원합니다.
- 저장은 전체 주 PUT이며 expected_revision을 필수로 받습니다. 신규 문서는 revision 0 → 1, 이후 원자적 UPDATE의 버전 조건으로 동시 수정을 검사합니다. 충돌은 409이며 기존 저장 내용을 덮어쓰지 않고 초안을 유지합니다.
- 날짜 비우기·초기화도 주 문서 수정으로 처리해 revision이 되돌아가지 않습니다. 없는 주를 읽을 때 DB에 빈 행을 생성하지 않습니다.
- 기존 로그인·세션·강제 비밀번호 변경·Origin/CSRF를 그대로 적용합니다. 익명 일정 조회·저장은 401, 초기화 비밀번호 상태는 403입니다. 공개 일정 API와 메뉴는 없습니다.
- 서버는 날짜·월요일 여부·최대 63일 조회 범위·허용 필드·글자 수·정수 크기·색상·템플릿 경로를 검사합니다. 외부 이미지 URL이나 임의 옵션을 받지 않습니다.

## 운영비와 의존성

기존 Workers/D1에 작은 주간 문서를 저장합니다. 이미지 생성은 관리자 브라우저가 처리하며 별도의 이미지 서버·R2 업로드·유료 서비스를 추가하지 않았습니다. 자동 폴링이나 정기 작업도 없습니다. 실제 무료 플랜 할당량은 기존 계정 사용량에 따릅니다.

html2canvas 1.4.1을 고정 버전으로 추가했습니다. 관련 코드와 편집기 화면은 경로 및 내보내기 시점에 나누어 불러옵니다. npm audit --omit=dev는 0건입니다. 전체 audit의 3개 high 항목은 기존 개발용 Miniflare의 sharp/undici 경로이며 이번 런타임 의존성에서 발생하지 않았습니다. 강제 자동 수정으로 기존 개발 런타임을 변경하지 않았습니다.

## 검증

- npm test: 단위·API 46개 통과. 일정 인증/CSRF/강제 변경, 저장/조회/비우기, 동시 생성·수정 충돌, 입력 검증, 윤년·연말·한국 날짜, 이미지 로딩 실패/시간 초과 포함.
- npm run test:e2e: 전체 브라우저 16개 통과. 기존 노래 CRUD·CSV·관리자 계정 관리도 통과.
- npm run test:ui: 기존 참고 UI 6개 통과.
- 편집기 디자인 변경 후 일정 브라우저 5개를 다시 실행해 모두 통과했고 최종 프로덕션 빌드가 성공했습니다. 총 고유 테스트 68개입니다.
- 8개 템플릿 내보내기, PNG/JPEG 규격, PC/모바일/원본 확대 PNG 바이트 동일, 출력 중 편집 잠금, 실패 후 복구, 저장 충돌 시 초안 유지 검증.
- 1920×1080 / 1440×900 / 768×1024 / 390×844 / 360×800에서 달력·이미지 편집기·날짜 입력창 15개 화면을 캡처하고 가로 넘침을 확인했습니다. 대표 화면과 실제 PNG를 직접 확인했습니다.
- 캡처·출력 예시: .local/schedule-review/. 테스트는 .local/e2e/state의 격리된 D1에서 실행했습니다. 추가 일정 테스트는 별도 로컬 클라이언트 IP를 사용해 기존 로그인 횟수 제한을 유지합니다.

## 파일과 보존

- 화면: src/pages/AdminSchedule.vue, AdminScheduleImage.vue; src/components/schedule/; src/styles/schedule.css.
- 브라우저 편집·출력: src/schedule/.
- 공유 순수 계약·날짜: shared/schedule/.
- 서버: server/routes/schedules.js, server/services/schedule-validation.js, server/repositories/schedules.js. 기존 admin 라우터의 인증 검사 뒤 분기합니다.
- 메뉴·라우터·스타일 진입: src/App.vue, src/components/AppSidebar.vue, src/router/index.js, src/main.js.
- 템플릿: public/images/schedule/. 의존성: package.json, package-lock.json.
- 실행 migration: migrations/0004_admin_schedule_weeks.sql. database/migrations/0004_admin_schedule_weeks.sql에는 같은 참고 사본을 보관합니다. 원격에는 실행 migration만 적용합니다.
- 테스트: tests/api.test.js, tests/schedule.test.js, tests/e2e/schedule.spec.js, tests/e2e/prepare.js.
- 작업 전 변경 백업: .local/schedule-before-1792157509688/. 사용자가 이전에 수정한 database/migrations/0001_initial.sql은 그대로 보존했습니다.
- 공개 일정표, 반복 일정, 다중 이벤트, SOOP 자동 연동과 이미지 게시 자동화는 이번 범위에 포함하지 않습니다.

## 운영 반영

- 원격 D1 사전 SQL 백업: .local/backups/zio-before-schedule-20261016-224634.sql (Git 제외).
- migration 0004를 로컬 및 운영에 적용했습니다. 기존 노래·관리자 테이블과 데이터는 변경하지 않았습니다.
- 운영 배포 완료: https://zio-home.ryan9320.workers.dev
- Worker 버전: `9fe1e198-b1c3-4649-b13e-934c2bb9caf2`.
- 운영 HTML/편집기 JS/CSS/이미지 출력 라이브러리/템플릿 배경이 최종 로컬 빌드와 동일함을 해시로 확인했습니다.
- Worker/D1 ready, 새 일정 테이블 조회 성공, 익명 일정 조회·저장 401 및 no-store, 공개 일정 API 404를 확인했습니다.
- PC 1440×900 및 모바일 390×844에서 보호된 달력·편집기 경로의 로그인 이동과 공개 홈을 확인했습니다. 운영 관리자 비밀번호를 사용하거나 테스트 계정·일정을 생성하지 않았습니다. 실제 인증 후 저장/이미지 출력은 격리된 D1 브라우저 테스트로 검증했습니다.
- 운영 점검 기록: .local/schedule-review/deployment.json.
