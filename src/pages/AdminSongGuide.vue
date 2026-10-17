<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import GuideLayout from "../components/guide/GuideLayout.vue";
import { songGuideReturnTo } from "../services/song-guide.js";

const route = useRoute();
const returnTo = computed(() => songGuideReturnTo(route.query.returnTo, true));
const returnLabel = computed(() =>
  /\/new(?:\?|$)/.test(returnTo.value)
    ? "등록 화면으로 돌아가기"
    : /\/edit(?:\?|$)/.test(returnTo.value)
      ? "수정 화면으로 돌아가기"
      : "노래 관리로 돌아가기",
);
const steps = [
  {
    title: "새 노래 등록 열기",
    text: "노래 관리에서 새 노래 등록을 눌러주세요.",
  },
  {
    title: "정보와 공개 여부 확인",
    text: "곡명·아티스트·숙련도와 신청 풍 개수를 정해요.",
  },
  {
    title: "미리 보고 저장하기",
    text: "등록하기를 누른 뒤 목록에서 저장된 곡을 확인해요.",
  },
];
const sections = [
  {
    id: "admin-song-register",
    label: "한 곡 등록",
    title: "처음 노래를 등록한다면",
  },
  {
    id: "admin-song-fields",
    label: "입력 항목",
    title: "각 항목은 이렇게 적어요",
  },
  {
    id: "admin-song-visibility",
    label: "공개·비공개",
    title: "방문자에게 보일 내용 정하기",
  },
  {
    id: "admin-song-manage",
    label: "수정·삭제",
    title: "등록한 노래 관리하기",
  },
  {
    id: "admin-song-csv",
    label: "CSV 일괄 등록",
    title: "여러 곡을 한 번에 추가하기",
  },
  {
    id: "admin-song-recovery",
    label: "백업·저장 오류",
    title: "작업을 이어가고 백업하기",
  },
  {
    id: "admin-song-faq",
    label: "자주 묻는 질문",
    title: "막히는 부분이 있나요?",
  },
];
const fields = [
  {
    label: "곡명·아티스트",
    text: "각각 필수이며 1~200자로 적어요. 같은 제목이라도 아티스트를 함께 확인해주세요.",
  },
  {
    label: "장르·언어",
    text: "장르는 60자, 언어는 40자까지 적을 수 있어요. 장르는 목록에서 고르거나 직접 입력해도 됩니다.",
  },
  {
    label: "신청 풍 개수",
    text: "0 이상의 정수로 입력해요. 소수나 음수는 저장할 수 없습니다.",
  },
  {
    label: "숙련도",
    text: "잎사귀를 눌러 1~5단계를 꼭 선택해주세요. 처음 등록할 때는 아직 선택되지 않은 상태예요.",
  },
  {
    label: "연습 상태",
    text: "미연습·연습중·완료·잠시 보류 중 하나를 골라요. 숙련도와 별도로 저장됩니다.",
  },
  {
    label: "공개 상태",
    text: "처음에는 공개로 선택되어 있어요. 준비 중인 곡은 비공개로 바꾼 뒤 저장해주세요.",
  },
  {
    label: "곡 설명",
    text: "공개 곡의 상세 화면에 표시되는 소개예요. 최대 5,000자까지 작성할 수 있어요.",
  },
  {
    label: "지오 메모",
    text: "연습 포인트처럼 관리자끼리 볼 내용을 적어요. 최대 3,000자이며 공개 화면에는 표시되지 않아요.",
  },
];
const csvFields = [
  ["title / artist", "곡명 / 아티스트. 둘 다 필수예요."],
  [
    "description / genre / language",
    "곡 설명 / 장르 / 언어. 사용하지 않아도 열은 남겨주세요.",
  ],
  ["proficiency", "숙련도 1~5. 비우면 1단계예요."],
  [
    "practice_status",
    "not_started(미연습), practicing(연습중), completed(완료), on_hold(잠시 보류). 비우면 미연습이에요.",
  ],
  ["balloon_cost", "0 이상의 정수. 비우면 0이에요."],
  ["memo", "관리자 전용 지오 메모. 비워도 됩니다."],
  ["is_public", "true 또는 1은 공개, false 또는 0은 비공개. 비우면 공개예요."],
];
</script>
<template>
  <GuideLayout
    title="노래 등록·관리 가이드"
    eyebrow="ZIO SONGBOOK EDITOR GUIDE"
    description="한 곡씩 등록하는 방법부터 CSV로 여러 곡을 추가하는 방법까지, 실제 화면 순서에 맞춰 안내해드릴게요."
    :sections="sections"
    :steps="steps"
    :return-to="returnTo"
    :return-label="returnLabel"
  >
    <template #admin-song-register>
      <ol>
        <li><strong>노래 관리 → 새 노래 등록</strong>을 누릅니다.</li>
        <li>
          <strong>곡명·아티스트·신청 풍 개수</strong>를 입력하고 잎사귀를 눌러
          <strong>숙련도</strong>를 선택합니다.
        </li>
        <li>
          연습 상태와 공개 상태를 정하고, 필요하면 장르·언어·곡 설명·지오 메모를
          적습니다.
        </li>
        <li>
          <strong>미리보기</strong>에서 표시될 정보를 확인한 뒤
          <strong>등록하기</strong>를 누릅니다. 모바일에서는 미리보기가 입력창
          아래에 있어요.
        </li>
        <li>
          목록으로 돌아오면 등록한 곡을 확인합니다. 공개로 저장했다면 공개
          노래책자에서도 확인할 수 있어요.
        </li>
      </ol>
      <p class="reading-guide-note">
        등록·수정 화면의 가이드는 <strong>새 탭</strong>에서 열립니다. 가이드
        탭을 닫고 원래 탭으로 돌아가면 입력하던 내용을 그대로 이어갈 수 있어요.
      </p>
      <RouterLink class="btn btn-primary" to="/admin/songs/new"
        >새 노래 등록하러 가기</RouterLink
      >
    </template>
    <template #admin-song-fields>
      <dl class="reading-guide-fields">
        <div v-for="field in fields" :key="field.label">
          <dt>{{ field.label }}</dt>
          <dd>{{ field.text }}</dd>
        </div>
      </dl>
      <p>
        별표가 붙은 항목과 숙련도를 확인해주세요. 저장이 안 된다면 표시되는 오류
        안내에 따라 입력을 수정하면 됩니다.
      </p>
    </template>
    <template #admin-song-visibility>
      <ul>
        <li>
          <strong>공개</strong>: 방문자가 노래책자와 상세 화면에서 볼 수 있어요.
        </li>
        <li>
          <strong>비공개</strong>: 관리자 노래 관리에서만 확인할 수 있어요.
          나중에 준비되면 공개로 전환할 수 있습니다.
        </li>
        <li>
          <strong>곡 설명</strong>은 공개할 소개를, <strong>지오 메모</strong>는
          내부 메모를 적는 곳이에요. 공개된 곡도 지오 메모는 방문자에게 보이지
          않습니다.
        </li>
      </ul>
      <p class="reading-guide-note">
        미리보기에는 입력한 곡 정보가 표시됩니다.
        <strong>공개 상태는 저장 전에 별도로 확인</strong>해주세요. 방문자에게
        보일 모습은
        <RouterLink to="/songs/guide">노래책자 사용 가이드</RouterLink>에서도
        확인할 수 있어요.
      </p>
    </template>
    <template #admin-song-manage>
      <ul>
        <li>
          <strong>수정</strong>: 노래 카드 또는 수정 버튼을 눌러 정보를 바꾸고
          <strong>수정하기</strong>를 누릅니다. 등록할 때와 같은 입력창을
          사용해요.
        </li>
        <li>
          <strong>공개·비공개 전환</strong>: 목록의 공개 또는 비공개 버튼으로
          바꿀 수 있어요. 저장되면 방문자에게도 반영됩니다.
        </li>
        <li>
          <strong>삭제</strong>: 삭제할 곡의 제목과 아티스트를 확인하고,
          확인창에서 삭제하기를 누릅니다. 삭제한 곡은 되돌릴 수 없으니 잠시 숨길
          곡은 비공개로 바꿔주세요.
        </li>
      </ul>
      <p>
        노래가 많으면 검색·필터·정렬과 페이지 이동을 사용하세요.
        <strong>공개 여부 필터</strong>로 비공개 곡만 모아볼 수도 있어요.
      </p>
    </template>
    <template #admin-song-csv>
      <ol>
        <li>
          <strong>노래 관리 → CSV 가져오기 → 빈 템플릿 다운로드</strong>를
          누릅니다.
        </li>
        <li>
          템플릿의 열 이름을 유지한 채 곡을 적고,
          <strong>CSV UTF-8</strong> 형식으로 저장합니다. 파일은
          <strong>1MB 이하, 최대 1,000곡</strong>까지 가능해요.
        </li>
        <li>
          파일을 선택하고 <strong>미리보기 및 검증</strong>을 누릅니다. 오류가
          있으면 안내된 행을 고친 후 파일을 다시 선택해주세요.
        </li>
        <li>
          중복 경고가 있다면 제목과 가수를 확인합니다. 같은 곡도 별도 곡으로
          추가하려는 경우에만 중복 추가 동의에 체크해주세요.
        </li>
        <li>
          정상 내용을 확인하고 <strong>곡 추가하기</strong>를 누릅니다.
          미리보기에는 처음 20곡만 보이지만 파일 전체를 검증해요.
        </li>
      </ol>
      <p class="reading-guide-note">
        CSV는 <strong>새 곡을 추가</strong>합니다. 기존 곡은 수정하지 않으며,
        같은 파일을 다시 가져오면 중복으로 추가될 수 있어요. 오류가 하나라도
        있으면 전체를 저장하지 않습니다.
      </p>
      <table class="reading-guide-table">
        <caption>
          템플릿의 열과 입력값
        </caption>
        <thead>
          <tr>
            <th scope="col">열 이름</th>
            <th scope="col">입력 방법</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[name, text] in csvFields" :key="name">
            <td>
              <code>{{ name }}</code>
            </td>
            <td>{{ text }}</td>
          </tr>
        </tbody>
      </table>
      <p>
        비워둔 항목도 열 이름은 삭제하지 마세요.
        <strong>is_public을 비우면 공개</strong>로 추가되므로 준비 중인 곡은
        <code>false</code>를 적어주세요.
      </p>
    </template>
    <template #admin-song-recovery>
      <h3>전체 CSV 백업</h3>
      <p>
        <strong>노래 관리 → 전체 CSV 백업</strong>을 누르면 검색 조건과 관계없이
        전체 곡을 다운로드합니다.
        <strong>비공개 곡과 지오 메모도 포함</strong>되므로 관리자용으로
        보관해주세요. 백업을 CSV 가져오기로 다시 올리면 기존 곡을 덮어쓰지 않고
        새 곡이 추가됩니다.
      </p>
      <h3>저장하지 못했을 때</h3>
      <p>
        오류 안내가 나오면 입력을 확인한 뒤 다시 저장해주세요. 다른 곳에서 같은
        곡을 먼저 수정했다면 <strong>저장된 내용과 비교</strong>를 눌러 사용할
        내용을 선택하고, 편집을 계속한 뒤 다시 <strong>수정하기</strong>를
        누릅니다.
      </p>
      <h3>초안으로 이어 쓰기</h3>
      <p>
        새로고침이나 재로그인 후 복구할 초안이 있으면 복구 안내가 나와요. 초안은
        같은 브라우저 탭에서 최대 24시간 유지되며 저장 완료와는 다릅니다. 탭을
        닫거나 로그아웃하면 초안을 잃을 수 있으니 작업을 마칠 때는 등록·수정을
        완료해주세요.
      </p>
    </template>
    <template #admin-song-faq>
      <div class="reading-guide-faq">
        <details>
          <summary>필수 항목을 적었는데 등록이 안 돼요.</summary>
          <p>
            숙련도 잎사귀를 눌렀는지, 신청 풍 개수가 0 이상의 정수인지
            확인해주세요. 새 곡은 숙련도가 선택되지 않은 상태에서 시작합니다.
          </p>
        </details>
        <details>
          <summary>등록한 곡이 공개 노래책자에 안 보여요.</summary>
          <p>
            노래 관리의 공개 여부와 현재 검색·필터를 확인해주세요. 비공개 곡은
            노래 관리에서 공개로 바꾼 뒤 확인할 수 있어요.
          </p>
        </details>
        <details>
          <summary>앨범 사진이나 영상 링크는 어디서 넣나요?</summary>
          <p>
            현재 운영 화면은 기본 커버를 사용합니다. 앨범 사진과 영상 링크를
            저장하는 기능은 아직 제공하지 않아요.
          </p>
        </details>
        <details>
          <summary>CSV 백업을 다시 올리면 이전 상태로 복구되나요?</summary>
          <p>
            CSV 가져오기는 추가 기능이므로 복구나 기존 곡 일괄 수정 용도로
            사용하지 마세요. 원래 상태로 복구해야 한다면 먼저 운영 담당자와
            확인해주세요.
          </p>
        </details>
        <details>
          <summary>가이드를 보다가 입력 내용이 사라지지는 않나요?</summary>
          <p>
            등록·수정 화면의 등록 가이드는 새 탭에서 열립니다. 원래 편집 탭에서
            계속 입력해주세요. 다른 화면으로 이동하거나 탭을 닫기 전에는 저장
            여부를 확인하는 것이 좋아요.
          </p>
        </details>
      </div>
    </template>
  </GuideLayout>
</template>
