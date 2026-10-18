# 홈페이지 테마와 화면 구성

## 사용 방법

- 관리자: 관리 → 메뉴 관리 → 테마 설정에서 세 가지 테마 중 선택합니다. ‘이 테마 미리보기’로 확인하고 ‘기본 테마 저장’으로 적용합니다.
- 미리보기는 관리자 화면에서만 잠시 적용됩니다. 종료·선택 취소·페이지 이동 시 기존 개인 선택으로 돌아옵니다.
- 방문자: 화면 상단의 ‘테마’ 버튼(모바일은 잎 아이콘)을 눌러 개인 테마를 선택합니다. 개인 선택은 해당 브라우저에만 저장됩니다.
- ‘사이트 기본값 따르기’를 선택하면 관리자 설정이 적용됩니다. 별빛 음악방도 정보 입력 영역은 밝은 화면을 사용합니다.
- 관리자 저장은 다음 방문 또는 새로고침부터 기본값을 따르는 방문자에게 반영됩니다. 개인 테마를 고른 방문자의 화면은 바뀌지 않습니다.

## 운영과 코드

- 기존 site_settings 테이블의 appearance.v1 키에 theme와 revision만 저장합니다. 별도 마이그레이션이나 유료 서비스가 필요하지 않습니다.
- 공개 GET /api/appearance는 theme 하나만 반환합니다. 관리자 GET/PUT /api/admin/appearance는 기존 로그인·초기 비밀번호 변경·동일 출처·CSRF 보호를 사용합니다.
- 저장 시 expected_revision이 맞아야 합니다. 충돌하면 선택을 보존하고 최신 설정 불러오기를 안내합니다.
- shared/appearance.js: 허용 테마와 기본값, 검증 및 우선순위. src/services/appearance.js: 개인 선택·임시 미리보기·기본값 불러오기. src/styles/themes.css: 공통 색상 토큰과 테마별 화면.
- 테마는 사이트 화면에 적용됩니다. 일정 이미지의 템플릿·내보내기 색상·데이터는 기존 구성을 따릅니다.
- 검색·로그인·노래 CRUD·CSV·비공개 메모 처리와 기존 URL을 유지합니다. 화면의 기본 커버는 장르별 로컬 일러스트이며 실제 앨범 이미지를 조회하는 기능은 아닙니다.
- 게시판, CMS, 즐겨찾기, 앨범 업로드, SOOP API 기능은 추가하지 않았습니다.
- 개인 선택의 저장이 차단되어도 현재 화면의 테마를 바꿀 수 있습니다. 다음 방문에는 저장된 선택이 없을 수 있다는 안내를 표시합니다.

## 시각 자료

사용자 제공 시안의 숲속 음악 공간, 어두운 사이드바, 밝은 입력 패널, 모바일 가로 노래 카드를 참고했습니다. 기존 지오 원본 이미지는 보존했습니다.

내장 imagegen 도구로 배경과 캐릭터 투명 이미지를 제작했습니다. 별도 API 키나 외부 이미지 호출은 사용하지 않습니다. 원본 PNG는 생성 도구 보관 경로에 유지하고 웹 전달용 WebP를 프로젝트에 저장했습니다.

- public/images/themes/forest-room-v1.webp: 1,600px 배경, 약 200KB.
- public/images/themes/zio-cutout-v1.webp: 600px 캐릭터, 약 82KB, 투명도 유지.

최종 배경 프롬프트:

> Use case: illustration-story. Asset type: wide website scene background for ZIO HOME, a cozy forest music room. Primary request: an atmospheric anime background illustration, lush green forest seen through tall café windows, warm wooden window sill, small cup and potted leafy plants, a music notebook and soft light. Landscape composition approximately 3:1, designed to crop into a website hero. Keep the left center visually quiet and dark enough for white text; elegant forest foliage and sunlit windows on right, no people because an existing character portrait will be layered separately. Deep forest green #113726, soft sage, warm ivory highlights. Detailed painterly anime environmental art, calm and welcoming, a grown-up music café feeling. No text, no letters, no interface, no logos, no watermark. This is a finished background illustration, not a webpage mockup.

최종 캐릭터 프롬프트:

> Use case: background-extraction, identity-preserve. Edit target: the attached Zio character portrait. Create a genuinely transparent background cutout of this exact character, preserving her identity, black long straight hair with bangs, bright green eyes, white jacket, black necktie, expression and anime style. Remove only the existing green background and the green halo around the silhouette; keep complete hair edges and shoulders. Extend slightly at the bottom to a clean waist-up portrait if needed but preserve face exactly. No text, no watermark, no new props. Transparent alpha background, suitable for layering over a forest café website hero.

## 확인 기준

PC 1920×1080, 1440×900, 태블릿 768×1024, 모바일 390×844, 360×800에서 세 테마의 메인·노래 목록·상세·등록·수정·설정 화면을 확인합니다. 관리자 저장·충돌·권한, 개인 선택 유지·기본값 복귀·저장 실패, 공개 상세의 메모 비노출과 기존 전체 테스트를 함께 확인합니다.

테마 이미지 경로에는 버전 번호가 있으며 브라우저에서 장기 캐시합니다. 이미지를 교체할 때는 v2처럼 새 경로를 사용하고 해당 참조를 함께 수정하세요.
