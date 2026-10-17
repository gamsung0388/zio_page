<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import GuideLayout from "../components/guide/GuideLayout.vue";
import LeafRating from "../components/LeafRating.vue";
import { proficiencyLabels, practiceLabels } from "../services/song-labels.js";
import { songGuideReturnTo } from "../services/song-guide.js";

const route = useRoute();
const returnTo = computed(() => songGuideReturnTo(route.query.returnTo));
const steps = [
  {
    title: "듣고 싶은 곡 찾기",
    text: "곡명이나 가수로 검색하고, 원하는 조건을 골라보세요.",
  },
  {
    title: "노래 정보 살펴보기",
    text: "잎사귀 숙련도와 연습 상태, 신청 풍 개수를 확인해요.",
  },
  {
    title: "방송에서 함께 듣기",
    text: "방송 중 신청 안내를 확인하고 듣고 싶은 곡을 전해주세요.",
  },
];
const sections = [
  { id: "songs-find", label: "검색·필터", title: "듣고 싶은 노래 찾기" },
  {
    id: "songs-level",
    label: "숙련도·연습 상태",
    title: "잎사귀와 연습 상태 읽기",
  },
  {
    id: "songs-details",
    label: "상세·신청 풍",
    title: "노래를 고르기 전 확인하기",
  },
  { id: "songs-faq", label: "자주 묻는 질문", title: "이런 점이 궁금한가요?" },
];
</script>
<template>
  <GuideLayout
    title="노래책자 사용 가이드"
    eyebrow="ZIO SONGBOOK GUIDE"
    description="처음 오셨나요? 지오의 노래를 찾고, 한 곡을 고르기까지 차근차근 안내해드릴게요."
    :sections="sections"
    :steps="steps"
    :return-to="returnTo"
    return-label="노래책자로 돌아가기"
  >
    <template #songs-find>
      <ol>
        <li>
          <strong>곡명 또는 가수 검색</strong>에 제목이나 가수 이름의 일부를
          입력해보세요. 입력을 마치면 검색 결과가 바뀝니다.
        </li>
        <li>
          <strong>숙련도·연습 상태·장르·언어</strong>를 골라 원하는 노래만
          모아볼 수 있어요. 여러 조건을 고르면 그 조건을 모두 만족하는 곡이
          나옵니다.
        </li>
        <li>
          목록 위 정렬에서
          <strong>최신 등록순·제목·가수·숙련도·풍 개수</strong> 순서를
          골라보세요.
        </li>
        <li>
          <strong>20곡씩·50곡씩·100곡씩</strong> 표시 개수를 바꿀 수 있고, 아래
          페이지 버튼으로 다른 노래도 볼 수 있어요.
        </li>
      </ol>
      <p class="reading-guide-note">
        검색 결과가 없다면 검색어를 짧게 바꾸거나 <strong>초기화</strong>를
        눌러보세요. 장르와 언어는 공개된 곡에 등록된 항목이 있을 때 표시됩니다.
      </p>
    </template>
    <template #songs-level>
      <p>
        잎사귀는 곡에 얼마나 익숙한지 나타내요. 채워진 잎사귀가 많을수록
        숙련도가 높습니다.
      </p>
      <dl class="reading-guide-levels">
        <div v-for="level in 5" :key="level">
          <dt>{{ level }}단계 · {{ proficiencyLabels[level] }}</dt>
          <dd><LeafRating :value="level" show-number /></dd>
        </div>
      </dl>
      <h3>연습 상태는 따로 확인해요</h3>
      <div class="reading-guide-statuses">
        <span v-for="(label, value) in practiceLabels" :key="value">{{
          label
        }}</span>
      </div>
      <p>
        숙련도와 연습 상태는 각각 관리합니다. 예를 들어 숙련도가 높아도 다시
        연습 중인 곡일 수 있어요. 방송에서 부를 수 있는지는 당시 방송 안내도
        함께 확인해주세요.
      </p>
    </template>
    <template #songs-details>
      <p>
        노래 카드를 누르면 상세 화면에서 곡명·아티스트·장르·곡 설명과
        숙련도·연습 상태·신청 풍 개수를 볼 수 있어요.
        <strong>목록으로 돌아가기</strong>를 누르면 보던 검색 조건과 페이지로
        돌아갑니다.
      </p>
      <h3>신청 풍 개수는 안내예요</h3>
      <p>
        표시된 숫자는 그 곡의 신청에 필요한 풍 개수 안내입니다. 홈페이지에서
        곡을 누르는 것만으로 신청되거나 결제되지는 않아요. 실제 신청 방법과 가능
        여부는 지오의 방송 중 안내를 따라주세요.
      </p>
      <p class="reading-guide-note">
        기본 커버가 보이더라도 같은 사진의 곡이라는 뜻은 아니에요. 곡명과
        아티스트를 함께 확인하면 원하는 곡을 찾기 쉬워요.
      </p>
    </template>
    <template #songs-faq>
      <div class="reading-guide-faq">
        <details>
          <summary>찾는 노래가 보이지 않아요.</summary>
          <p>
            검색어의 띄어쓰기를 바꾸거나 필터를 초기화해보세요. 아직 등록되지
            않았거나 비공개인 곡은 공개 노래책자에서 볼 수 없습니다.
          </p>
        </details>
        <details>
          <summary>연습 완료인데 숙련도가 5단계가 아니에요.</summary>
          <p>
            연습 상태와 숙련도는 서로 다른 정보입니다. 두 항목을 함께 보고 곡의
            현재 상태를 확인해주세요.
          </p>
        </details>
        <details>
          <summary>로그인해야 노래책자를 볼 수 있나요?</summary>
          <p>노래 검색과 상세 보기는 로그인 없이 이용할 수 있어요.</p>
        </details>
        <details>
          <summary>노래를 누르면 신청이 접수되나요?</summary>
          <p>
            카드를 누르면 곡 정보만 열립니다. 신청은 방송 중 안내에 따라
            진행해주세요.
          </p>
        </details>
      </div>
    </template>
  </GuideLayout>
</template>
