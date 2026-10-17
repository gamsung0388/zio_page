# 03. REST API 계약 (v1)

모든 API는 같은 도메인의 `/api` 하위 경로. JSON 응답, 공통 실패 형태 `{ "error": { "code": "...", "message": "..." } }` (내부 스택 미노출). HTTP 의미에 맞는 상태 코드 사용.

## 공개
| 메서드 | URL | 설명 |
|---|---|---|
| GET | `/api/health` | DB 의존 여부 구분된 간단 상태 |
| GET | `/api/songs` | 공개 노래 조회 |
| GET | `/api/songs/:id` | 공개 노래 상세, 비공개면 404 |

`GET /api/songs?q=&proficiency=&practice_status=&genre=&language=&sort=recent&page=1&page_size=20`
허용 정렬: `recent,title_asc,title_desc,artist_asc,artist_desc,proficiency_asc,proficiency_desc,balloon_asc,balloon_desc`. 전부 whitelist. 응답: `{ "items": [], "pagination": {"page":1,"page_size":20,"total":0} }`.
공개 JSON에 `memo`, 비공개 곡 및 인증정보 절대 포함 금지.

## 관리자
| 메서드 | URL | 용도 |
|---|---|---|
| POST | `/api/admin/login` | 로그인, 성공 시 HttpOnly 세션 쿠키 |
| POST | `/api/admin/logout` | 세션 폐기 및 쿠키 만료 |
| GET | `/api/admin/me` | 인증 상태/표시 이름/비밀번호 변경 필요 상태 |
| GET | `/api/admin/users` | 관리자 목록(인증 필수, 기본 20/최대 100) |
| POST | `/api/admin/users` | 기존 관리자가 추가 관리자 등록 |
| PATCH | `/api/admin/password` | 현재 비밀번호 확인 후 본인 비밀번호 변경 |
| POST | `/api/admin/users/:id/reset-password` | 초기 비밀번호 설정, 강제 변경, 세션 폐기 |
| GET | `/api/admin/songs` | 공개/비공개 전체 조회 |
| GET | `/api/admin/songs/:id` | 수정 폼용 단건 조회, 비공개·메모 포함, 인증 필수 |
| POST | `/api/admin/songs` | 곡 생성 |
| PATCH | `/api/admin/songs/:id` | 곡 수정 |
| DELETE | `/api/admin/songs/:id` | 곡 삭제 |
| GET | `/api/admin/songs/export.csv` | 전체 CSV (인증 필수) |
| POST | `/api/admin/songs/import/preview` | CSV 유효성 미리보기 (서버 검증) |
| POST | `/api/admin/songs/import` | 서버 검증 후 삽입, 실패 내역 반환 |

인증 필요한 요청의 권한 검사는 클라이언트 라우터 가드와 별개로 **Worker에서 수행**. write 요청은 Origin 확인 및 CSRF 방어를 적용한다. 관리자 API는 `no-store`.

## API 데이터 필드
`id, title, artist, description, genre, language, proficiency, practice_status, balloon_cost, is_public, created_at, updated_at`, 관리자에게만 `memo, revision`.
필드는 서버 스키마로 검증하고 예상치 못한 속성은 거부 또는 무시를 명시적으로 통일한다. `is_public`은 boolean으로 주고받되 DB에서는 0/1.

## CSV
컬럼: `title,artist,description,genre,language,proficiency,practice_status,balloon_cost,memo,is_public`. UTF-8, BOM 허용, 쉼표/큰따옴표/줄바꿈이 있는 표준 CSV 처리. 최대 예: 1MB 또는 1000행; 서버 측 확인. 중복 발견 시 사전 미리보기/경고. import는 기본 append-only, 기존 곡 덮어쓰기 없음.

## 관리자 계정 확장
요청 필드·에러 코드·강제 변경 정책은 [09 관리자 계정](09_ADMIN_ACCOUNTS.md)을 따른다. 계정 응답에는 비밀번호·해시·salt를 포함하지 않는다. 초기화 상태에서는 me/logout/password 외 관리 API에 403 PASSWORD_CHANGE_REQUIRED를 반환한다.

## 관리자 일정 관리 (추가 요청)

| 메서드 | URL | 용도 |
|---|---|---|
| GET | `/api/admin/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD` | 월간 달력 범위의 주간 문서 조회, 최대 63일 |
| GET | `/api/admin/schedules/:week_start` | 월요일로 시작하는 주간 문서. 미저장 주는 revision 0과 기본값 |
| PUT | `/api/admin/schedules/:week_start` | 주간 문서 저장. expected_revision 필수, 충돌 409 |
| DELETE | `/api/admin/schedules/:week_start` | 선택 주의 내용·이미지 설정 삭제. 양의 expected_revision 필수 |

인증·강제 비밀번호 변경 검사·Origin/CSRF 검증은 기존 관리자 미들웨어를 공유합니다. 모든 일정 응답은 no-store이며 공개 일정 API는 없습니다. 요청·검증·저장 필드와 마이그레이션은 [12 관리자 일정 관리](12_ADMIN_SCHEDULE.md)를 따릅니다.

### 일정 JSON 백업

`GET /api/admin/schedules/backup?after=YYYY-MM-DD`는 인증된 관리자에게 최대 50개의 주간 문서와 `next_after`를 반환합니다. 첫 요청은 after를 생략하며 다음 요청에는 반환된 커서를 전달합니다. 커서는 월요일 날짜이며 다른 쿼리·중복 after는 거부합니다. 마지막 페이지의 next_after는 null입니다. 기존 일정 조회와 동일하게 강제 비밀번호 변경 검사를 받고 no-store로 반환하며 updated_by나 계정 비밀값은 포함하지 않습니다.

브라우저의 JSON 파일은 `{version:1,exported_at, weeks:[{week_start,selectedTemplate,scheduleForm,editorOptions}]}`입니다. 버전·주 날짜·중복·알 수 없는 항목·길이·템플릿·옵션을 공용 검증으로 확인합니다. 최대 2,000주·10MB이고 선택 주를 현재 주의 편집 화면에 가져온 뒤 기존 PUT과 expected_revision으로 수동 저장합니다. 새 쓰기 API나 일괄 강제 덮어쓰기는 추가하지 않았습니다.

## 관리자 개별 일정과 기간

| 메서드 | URL | 용도 |
|---|---|---|
| GET | `/api/admin/schedule-events?from=YYYY-MM-DD&to=YYYY-MM-DD&kind=&page=1&page_size=200` | 겹치는 개별 일정 조회, 최대 63일, 페이지당 최대 200 |
| POST | `/api/admin/schedule-events` | 개별 일정 등록 |
| GET | `/api/admin/schedule-events/:id` | 일정 수정용 단건 조회 |
| PUT | `/api/admin/schedule-events/:id` | 전체 일정 수정, expected_revision 필수 |
| DELETE | `/api/admin/schedule-events/:id` | 해당 일정 삭제, JSON expected_revision 필수 |
| GET | `/api/admin/schedule-events/backup?after=ID` | 전체 백업용 id 순서 조회, 200개 및 next_after |

입력은 title/description/kind/time_mode/start_date/end_date/start_time/end_time입니다. 시간은 HH:mm이며 시간 지정 외에는 빈 문자열이어야 합니다. 서버가 한국 날짜/시각을 UTC starts_at/ends_at으로 변환합니다. 종료가 정확히 자정이면 다음 날짜 조회에서 제외하고, 종일/시간 미정의 종료 날짜는 포함합니다. 정규 시각 외 자유 안내는 기존 주간 메모 API로 유지합니다.

기존 관리자 인증·강제 비밀번호 변경·Origin·CSRF를 공유하며 모두 no-store입니다. 제목 1~120자, 설명 0~2000자, 등록 날짜 2000~2099년, 최대 366일을 검증합니다. 잘못된 JSON 객체는 기존 공통 400, 필드 검증은 422, 수정/삭제 버전 충돌은 409입니다. updated_by/인증 비밀값은 응답하지 않습니다. 자세한 계약은 [16 개별 일정](16_INDIVIDUAL_SCHEDULE_EVENTS.md)에 기록합니다.

### 저장된 주간 메모 삭제

주간 GET/PUT/DELETE 응답은 `is_saved`로 저장 여부를 나타냅니다. 새 미저장 주는 revision 0이며, 삭제된 주는 기본값과 `is_saved:false`를 반환하되 이전 버전을 증가시켜 보존합니다. DELETE JSON은 `{ "expected_revision": 양의 정수 }`만 허용하며 변경·이미 삭제·미저장 주는 409입니다. 삭제된 내용과 스타일은 제거하고 목록/백업에서 제외합니다. 다른 주와 개별 일정은 유지합니다. [삭제·복구·버전 계약](18_WEEKLY_MEMO_DELETE.md).

## 노래 변경 버전 검사 (2026-10-17)

관리자 노래 목록·상세·생성·수정 응답에는 양의 정수 revision을 포함합니다. 공개 API에는 memo와 revision을 포함하지 않으며 CSV 열은 변경하지 않습니다. PATCH JSON은 변경 필드와 expected_revision을, DELETE JSON은 expected_revision 하나만 받습니다. 누락·유효하지 않은 버전은 422 SONG_REVISION, 수정·삭제 시 저장 버전 불일치 또는 삭제된 곡은 409 SONG_CONFLICT입니다. GET의 없는 곡은 기존 404입니다.

수정 SQL의 ID와 revision 검사 및 버전 증가는 한 문장으로 수행합니다. 오래된 요청을 최신 버전으로 자동 재시도하지 않습니다. 기존 세션·Origin·CSRF·강제 비밀번호 변경과 no-store는 유지합니다. 적용 migration 0006과 비교 UI는 [21 구현 기록](21_PRIORITY_REFACTOR.md)을 따릅니다.
