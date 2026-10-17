# 06. 2차 방송 일정표 확장 명세

> 2026-10-17: 아래 초안 중 관리자용 다중 일정·시작/종료 시각·기간 기능을 구현했습니다. 실제 스키마/API는 [16 개별 일정](16_INDIVIDUAL_SCHEDULE_EVENTS.md)을 따릅니다. 공개 일정과 반복 기능은 별도 범위입니다.

> 2026-10-16 추가 요청으로 관리자 전용 달력·주간 이미지 편집기를 구현했습니다. 현재 적용 범위와 저장 계약은 [12 관리자 일정 관리](12_ADMIN_SCHEDULE.md)를 우선합니다. 아래 공개 일정표·이벤트형 모델은 향후 확장 초안입니다.

최초 1차 범위에서는 보류했으며, 이번 추가 요청으로 관리자 전용 기능만 확장했습니다.

## 예정 기능
- 공개 `/schedule`: 주간 캘린더, 오늘 날짜, 방송/휴방/특별 일정 표시, 모바일 리스트 뷰.
- 관리자 `/admin/schedule`: 일정 CRUD, 시작·종료 시간, 제목, 설명, 태그, 상태, 링크, 공개 여부, 주간 일괄 입력.
- 한국 표준시(`Asia/Seoul`) 기준 표시. API/DB는 UTC ISO8601 저장 원칙.
- 반복 일정, 이미지형 일정표 내보내기는 2차 요구 수집 후 결정.

## 미래 D1 모델 초안 (실제 1차 스키마에는 추가 금지)
`schedules(id, title, description, start_at_utc, end_at_utc, status, link_url, is_public, created_at, updated_at)`.
노래책자와 독립 테이블 및 독립 `server/routes/schedules.js`, `src/pages/Schedule` 구성. 공통 인증 미들웨어/사이트 레이아웃만 재사용.

## 확장 지침
새 migration을 추가하고 기존 migration 변경 금지. 노래책자 API 동작/성능에 회귀가 없도록 테스트 작성.
