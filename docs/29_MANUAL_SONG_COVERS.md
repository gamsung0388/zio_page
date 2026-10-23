# 앨범 사진 직접 등록과 외부 검색 일시 중지

2026-10-23. 운영 Cloudflare에서 Apple 검색이 공유 IP의 HTTP 429를 반환하는 것을 실제 원격 미리보기에서 확인했습니다. 외부 제공처를 재검토하는 동안 직접 사진 등록을 사용합니다.

## 사용법

- 노래 관리의 등록/수정에서 앨범 사진을 선택합니다. JPG·PNG·WEBP, 파일당 최대 10MB입니다.
- 브라우저가 원본 비율을 유지하며 최대 512px·32KB의 정지 WebP 표지로 변환합니다. 원본 파일과 원본 파일명은 서버에 보내지 않습니다. 미리보기 확인 후 노래를 저장해야 반영됩니다.
- 사진 변경/삭제 역시 저장해야 반영됩니다. 사진을 삭제하면 기존 앨범 표지 또는 기본 그림으로 돌아갑니다. 기존 앨범 연결 해제는 별도입니다.
- 외부 검색·새 연결은 준비 중으로 안내합니다. 저장된 앨범 ID·출처·공식 링크는 삭제하지 않습니다. 직접 사진이 있으면 먼저 표시합니다.
- 사진은 곡 복사·초안·변경 충돌 비교·휴지통 복원·JSON/SQL 백업에 보존됩니다. CSV는 기존 10개 컬럼을 유지하며 사진을 포함하지 않습니다. JSON은 최대 64MB/10,000곡이고 그 이상은 SQL 백업을 사용합니다.

## 저장과 접근

실행 migration 0011은 songs.cover_image 한 컬럼만 추가합니다. 기존 곡/앨범 값은 변경하지 않습니다. 별도 유료 리소스나 R2 계정 설정을 추가하지 않습니다. 데이터 본문은 관리자 단일 곡 조회와 보호된 백업에서만 반환합니다. 목록·공개 JSON에는 cover_url만 제공합니다. 일반 목록은 이미지 본문을 SELECT하지 않습니다.

공개 사진 경로는 /api/songs/:id/cover이고 비공개/삭제된 곡은 404입니다. 관리자 경로 /api/admin/songs/:id/cover는 기존 세션·강제 비밀번호 변경 검사를 거칩니다. no-store로 공개 해제와 휴지통 상태를 매번 확인하고 image/webp + nosniff + same-origin CORP로 반환합니다. 외부 URL·SVG·위조 포맷·애니메이션·초과 크기는 서버/백업/초안 공통 검증에서 거부합니다.

사진과 곡 정보는 기존 revision 조건의 단일 SQL 쓰기에서 함께 저장합니다. 저장을 취소하면 서버 파일이나 미사용 업로드가 남지 않습니다. 기존 보통 JSON 요청 제한은 64KB를 유지하고 사진이 포함되는 단일 곡 등록/수정만 128KB로 제한합니다. 새 패키지 의존성은 없습니다.

표지는 데이터 URL의 base64로 저장되므로 사진당 최대 약 44KB와 SQLite 저장 오버헤드가 필요합니다. 작은 노래책자 운영을 위한 방식이며 많은 원본 사진을 보관하는 갤러리로 사용하지 않습니다. 곡 수·트래픽 증가 시 객체 저장소와 별도 접근 제어를 검토합니다. [Cloudflare D1 제한](https://developers.cloudflare.com/d1/platform/limits/) · [WebP 컨테이너 사양](https://developers.google.com/speed/webp/docs/riff_container).

## 검증과 배포

단위/실제 workerd·D1 API 136개, 실제 브라우저 90개, 참고 UI 6개로 고유 테스트 232개가 통과했습니다. 운영 빌드가 성공했습니다. 테스트는 별도 로컬 DB에서 수행하며 운영 콘텐츠를 등록/수정하지 않습니다. 사진 포함 JSON 가져오기와 사진 등록 UI의 1920×1080, 1440×900, 768×1024, 390×844, 360×800 크기를 확인했습니다. 운영 migration 전 SQL 백업 verified-20261023225133-c78cb2f6은 13개 테이블의 격리 복원·무결성을 통과했습니다. 첫 접근은 기존 OAuth 토큰 갱신 후 재시도했습니다. 운영 migration 0011 적용과 [zio-home.com](https://zio-home.com) 배포를 완료했습니다. 코드 소스는 4ad3263366edecb0e2f8d086789a6aabe756fd9b, Worker 버전은 126534c5-297d-4f03-83d5-cdf2c5fb8c9c입니다. [GitHub 전체 검증](https://github.com/gamsung0388/zio_page/actions/runs/39965283764)도 성공했습니다. 배포 후 운영 파일 89개가 로컬 빌드와 일치하고, 공개 노래 10곡·테마를 보존했으며 DB 연결과 비인증 관리자 접근 차단을 확인했습니다. 5개 화면 크기의 공개/관리 화면 45개를 확인했고 앱 실행 오류·Vue 경고·앱 CSP 위반은 0건입니다. 관리자 운영 화면의 배포 확인은 GET 응답을 대체하는 읽기 전용 화면 검증이고 실제 등록·수정·삭제는 격리 D1의 회귀 테스트에서 검증했습니다. 운영 콘텐츠 테스트 쓰기는 0건입니다. 새 컬럼 적용 후 SQL 백업 verified-20261023225637-d1117ae4도 13개 테이블의 격리 복원과 무결성을 통과했습니다. 사용자 원본 SQL 변경과 ZIP은 보존하고 커밋에서 제외했습니다.

## 변경 파일

- README.md
- docs/27_OPERATIONS_AND_ALBUMS.md
- docs/28_OPERATIONS_QA.md
- docs/29_MANUAL_SONG_COVERS.md
- migrations/0011_song_cover_images.sql
- server/repositories/songs.js
- server/routes/admin.js
- server/routes/public.js
- server/routes/songs.js
- server/services/catalog.js
- server/services/song-images.js
- server/services/song-validation.js
- server/utils/http.js
- shared/song-backup.js
- shared/song-image.js
- src/components/AlbumPicker.vue
- src/components/SongBackupImport.vue
- src/components/SongConflictReview.vue
- src/components/SongCoverUpload.vue
- src/pages/AdminSongGuide.vue
- src/pages/SongGuide.vue
- src/services/song-adapter.js
- src/services/song-backup.js
- src/services/song-draft.js
- src/services/song-image.js
- src/services/song-review.js
- src/styles/song-image.css
- src/views/SongFormView.vue
- tests/api.test.js
- tests/e2e/operations.spec.js
- tests/fixtures/song-image.js
- tests/song-images.test.js
