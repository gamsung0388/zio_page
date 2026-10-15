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
| POST | `/api/admin/songs` | 곡 생성 |
| PATCH | `/api/admin/songs/:id` | 곡 수정 |
| DELETE | `/api/admin/songs/:id` | 곡 삭제 |
| GET | `/api/admin/songs/export.csv` | 전체 CSV (인증 필수) |
| POST | `/api/admin/songs/import/preview` | CSV 유효성 미리보기 (서버 검증) |
| POST | `/api/admin/songs/import` | 서버 검증 후 삽입, 실패 내역 반환 |

인증 필요한 요청의 권한 검사는 클라이언트 라우터 가드와 별개로 **Worker에서 수행**. write 요청은 Origin 확인 및 CSRF 방어를 적용한다. 관리자 API는 `no-store`.

## API 데이터 필드
`id, title, artist, description, genre, language, proficiency, practice_status, balloon_cost, is_public, created_at, updated_at`, 관리자에게만 `memo`.
필드는 서버 스키마로 검증하고 예상치 못한 속성은 거부 또는 무시를 명시적으로 통일한다. `is_public`은 boolean으로 주고받되 DB에서는 0/1.

## CSV
컬럼: `title,artist,description,genre,language,proficiency,practice_status,balloon_cost,memo,is_public`. UTF-8, BOM 허용, 쉼표/큰따옴표/줄바꿈이 있는 표준 CSV 처리. 최대 예: 1MB 또는 1000행; 서버 측 확인. 중복 발견 시 사전 미리보기/경고. import는 기본 append-only, 기존 곡 덮어쓰기 없음.

## 관리자 계정 확장
요청 필드·에러 코드·강제 변경 정책은 [09 관리자 계정](09_ADMIN_ACCOUNTS.md)을 따른다. 계정 응답에는 비밀번호·해시·salt를 포함하지 않는다. 초기화 상태에서는 me/logout/password 외 관리 API에 403 PASSWORD_CHANGE_REQUIRED를 반환한다.
