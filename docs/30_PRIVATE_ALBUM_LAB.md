# 개인 앨범 연결 실험실

2026-10-24. admin 계정 전용 임시 테스트 공간입니다. 운영 노래의 앨범 검색 재개는 별도 검증 후 결정합니다.

## 사용

admin 로그인 후 상단의 작은 플라스크 아이콘으로 /admin/album-lab에 들어갑니다. 다른 관리자와 방문자에게 아이콘을 표시하지 않으며, 서버도 계정을 확인합니다. 곡명·가수와 국가를 선택하고 브라우저 직접 / 홈페이지 서버 경유 방식을 비교합니다. HTTP 상태·걸린 시간·후보를 확인하고 연결 미리보기로 표지와 공식 출처를 시험합니다. 미국 검색에서도 한국 곡을 찾을 수 있습니다. 결과 0건은 연결 실패와 구분합니다.

검색 결과와 선택은 페이지 메모리에만 있고 노래 DB·초안·백업·홈페이지 설정에 저장하지 않습니다. 나가거나 새로고침하면 사라집니다. 운영 폼은 직접 사진 등록과 기존 연결 보존을 유지하고 외부 검색은 계속 준비 중입니다.

## 접근과 네트워크

페이지와 API 모두 기존 활성 세션/초기 비밀번호 변경 검사 후 username=admin을 확인합니다. 페이지 HTML은 Worker 우선 경로에서 보호하고 익명은 로그인, 다른 계정은 404입니다. no-store/Vary:Cookie/noindex를 적용합니다. 아이콘은 주소를 드러내지 않는 진입 장치이고 접근 제한은 서버에서 처리합니다. 기존 관리자 간 비밀번호 초기화 등 계정 관리 권한은 변경하지 않습니다.

브라우저 직접 요청은 테스트 문서의 connect-src에만 https://itunes.apple.com을 추가합니다. script-src는 self를 유지합니다. 진입/이탈은 문서 이동으로 처리해 일반 문서의 정책을 유지합니다. 검색 허용은 매번 owner+Origin+CSRF를 확인한 API를 거칩니다. 외부 요청은 credentials:omit/no-referrer와 8초 제한을 사용하고 고정 제공처 URL과 기존 앨범 허용 목록으로 결과를 검증합니다. 브라우저 자체의 CORS/네트워크 제한은 성공으로 간주하지 않습니다.

두 경로는 기존 D1 분당 10회 한도를 공통으로 사용합니다. 실험실 서버 검색은 캐시를 사용하거나 저장하지 않고 실제 제공처 상태를 반환합니다. 진단에는 토큰·쿠키·IP·원본 장애 본문을 넣지 않습니다. DB 변경은 기존 catalog_limits의 횟수 기록뿐이며 새 테이블·마이그레이션·외부 키·유료 리소스는 없습니다.

## 검증

단위/실제 workerd·D1 API 141개, 전체 브라우저 93개, 참고 UI 6개로 고유 테스트 240개가 통과했고 운영 빌드가 성공했습니다. 익명·다른 관리자·강제 비밀번호 변경·Origin·CSRF·분당 제한·실제 전역 fetch의 HTTP 429/200·운영 검색 중지 유지·검색 취소·반응형 다섯 크기를 확인했습니다. 정적 자산 index.html의 자동 307 이동을 실제 E2E에서 발견해 인증된 원래 경로의 SPA 문서를 제공하도록 수정했습니다.

실제 외부 검색은 별도의 로컬 D1 세션과 Microsoft Edge에서 응답 대체 없이 검증했습니다. 검은행복/미국에서 후보 10개와 Black Happiness 표지·공식 링크·연결 미리보기를 확인했습니다. 한국은 HTTP 200/결과 없음으로 실패와 구분합니다. 노래 데이터 전후 일치·운영 쓰기 0건이고 실서비스 admin 비밀번호를 도구에 입력하지 않았습니다. 이는 로컬 브라우저의 실검색 확인이며 실제 운영 계정의 최종 확인은 본인이 로그인해서 진행합니다. 운영 폼은 재활성화하지 않았습니다.

## 변경 파일

- docs/30_PRIVATE_ALBUM_LAB.md
- server/index.js
- server/routes/admin.js
- server/routes/album-lab.js
- server/services/catalog-limit.js
- server/services/catalog.js
- shared/album-lab.js
- shared/catalog-query.js
- src/components/AppHeader.vue
- src/pages/AlbumLab.vue
- src/router/index.js
- src/services/album-lab.js
- src/services/return-to.js
- src/styles/album-lab.css
- tests/album-lab.test.js
- tests/api.test.js
- tests/e2e/album-lab.spec.js
- wrangler.jsonc
