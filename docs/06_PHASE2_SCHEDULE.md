# 06. 2차 방송 일정표 확장 명세 — 현재 미구현

1차에서는 화면/DB/API를 구현하지 않는다. 향후 사용자의 별도 승인 이후 추가.

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
