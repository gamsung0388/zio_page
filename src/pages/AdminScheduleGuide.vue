<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { isDate, mondayOf, todayKst } from "../../shared/schedule/dates.js";
import { isEventDate, EVENT_KINDS } from "../../shared/schedule/events.js";
import ScheduleNav from "../components/schedule/ScheduleNav.vue";
const route = useRoute();
const month = computed(() =>
  isEventDate(route.query.month + "-01")
    ? route.query.month
    : isEventDate(route.query.week)
      ? route.query.week.slice(0, 7)
      : todayKst().slice(0, 7),
);
const week = computed(() =>
  isDate(route.query.week)
    ? mondayOf(route.query.week)
    : mondayOf(month.value + "-01"),
);
const kind = computed(() =>
  EVENT_KINDS.some((item) => item.value === route.query.kind)
    ? route.query.kind
    : undefined,
);
const day = computed(() =>
  isEventDate(route.query.day) ? route.query.day : undefined,
);
const listTarget = computed(() => ({
  path: "/admin/schedule",
  query: { month: month.value, view: "list", day: day.value, kind: kind.value },
}));
const sections = [
  { id: "guide-register", label: "날짜·시간 등록" },
  { id: "guide-image", label: "이미지 만들기" },
  { id: "guide-memo", label: "주간 메모·삭제" },
  { id: "guide-backup", label: "백업·복구" },
  { id: "guide-drafts", label: "초안·충돌" },
  { id: "guide-faq", label: "자주 묻는 질문" },
];
function jumpTo(id) {
  const element = document.getElementById(id);
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({ block: "start" });
}
</script>
<template>
  <div class="schedule-page schedule-guide-page">
    <div class="page-intro" id="guide-top" tabindex="-1">
      <div>
        <span class="eyebrow">ZIO SCHEDULE GUIDE</span>
        <h1>일정 관리 사용 가이드 <span class="heading-sprout">✿</span></h1>
        <p>
          날짜를 골라 일정을 등록하고, 주간 이미지와 메모를 관리하는 방법이에요.
        </p>
      </div>
      <RouterLink class="btn btn-primary" :to="listTarget"
        >일정 목록으로</RouterLink
      >
    </div>
    <ScheduleNav />
    <div class="guide-summary" aria-label="일정 관리 화면 안내">
      <article>
        <h2>일정 달력·목록</h2>
        <p>
          일정의 제목·구분·기간·시간을 등록합니다. 같은 날 여러 일정을 각각
          관리할 수 있어요.
        </p>
      </article>
      <article>
        <h2>스케줄 이미지</h2>
        <p>
          일정을 골라 주간 이미지에 넣고 꾸밉니다. PNG·JPEG 다운로드와 이미지
          메모 저장을 제공합니다.
        </p>
      </article>
      <article>
        <h2>주간 이미지 메모</h2>
        <p>
          이미지에 쓸 날짜별 문구와 시간 안내를 보관합니다. 개별 일정과 따로
          저장하며 한 주 단위로 삭제할 수 있어요.
        </p>
      </article>
    </div>
    <nav class="card guide-contents" aria-label="가이드 목차">
      <h2>필요한 내용부터 찾아보세요</h2>
      <div>
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          @click="jumpTo(section.id)"
        >
          {{ section.label }}
        </button>
      </div>
    </nav>
    <section class="card guide-section" aria-labelledby="guide-register">
      <h2 id="guide-register" tabindex="-1">1. 원하는 날짜에 일정 등록하기</h2>
      <ol>
        <li>
          <strong>일정 목록</strong>에서 <strong>등록할 날짜</strong>를 직접
          입력하거나 날짜 선택기를 엽니다.
        </li>
        <li>
          <strong>선택한 날짜에 일정 등록</strong>을 누릅니다. 위쪽의
          <strong>새 일정 등록</strong>도 선택한 날짜를 사용해요. 목록의 날짜 옆
          <strong>＋ 일정 추가</strong>를 누르면 그 날짜로 바로 열립니다.
        </li>
        <li>
          제목·일정 구분·시작일·종료일과 시간을 확인합니다. 등록창 안에서도
          날짜를 바꿀 수 있어요.
        </li>
        <li>
          <strong>일정 저장</strong>을 누릅니다. 달력 보기에서는 날짜의 ＋를
          눌러 같은 등록창을 열 수 있습니다.
        </li>
      </ol>
      <h3>시간과 기간은 이렇게 정해요</h3>
      <ul>
        <li>
          <strong>시간 지정</strong>: 시작보다 종료가 늦어야 합니다. 날짜와
          시간은 한국 시간 기준입니다.
        </li>
        <li>
          <strong>종일·시간 미정</strong>: 종료 날짜까지 포함합니다.
          17일~19일이면 3일간 표시돼요.
        </li>
        <li>
          여러 날 이어지는 일정도 하나의 일정입니다. 어느 날짜에서 수정하든 해당
          일정 전체에 반영됩니다. 최대 366일까지 등록할 수 있어요.
        </li>
      </ul>
      <p class="guide-example">
        밤 11시부터 다음 날 새벽 1시라면 시작일은 17일, 종료일은 18일로
        정하세요. 자정 00:00에 끝나는 일정은 다음 날 칸에 표시되지 않습니다.
      </p>
      <RouterLink class="btn btn-outline" :to="listTarget"
        >날짜를 골라 등록하러 가기</RouterLink
      >
    </section>
    <section class="card guide-section" aria-labelledby="guide-image">
      <h2 id="guide-image" tabindex="-1">
        2. 등록한 일정으로 주간 이미지 만들기
      </h2>
      <ol>
        <li>
          일정 등록창에서 <strong>저장하고 이미지 만들기</strong>를 누르거나,
          스케줄 이미지 화면에서 원하는 주를 선택합니다.
        </li>
        <li>
          <strong>등록된 일정 가져오기</strong>에서 이미지에 넣을 일정을
          고릅니다. 개인·기타 일정은 처음에 선택되지 않으므로 필요한 경우 직접
          체크하세요.
        </li>
        <li>
          <strong>선택 일정 채우기</strong>를 누르고 미리보기를 확인합니다. 같은
          날 여러 일정이 있으면 시간과 제목이 함께 들어갑니다.
        </li>
        <li>
          필요한 날짜의 문구·시간, 템플릿·글자·색상을 조정한 뒤
          <strong>PNG 저장</strong> 또는 <strong>JPEG 저장</strong>을 누릅니다.
        </li>
        <li>
          다음에도 같은 편집 내용을 쓰려면 <strong>일정 저장</strong>을
          누릅니다. 이미지 다운로드와 메모 저장은 각각 수행합니다.
        </li>
      </ol>
      <p class="guide-example">
        이미지 편집 화면의 저장은 주간 이미지 메모에 반영됩니다. 개별 일정의
        날짜·시간을 바꾸려면 일정 달력·목록에서 수정하세요.
      </p>
      <p>
        글자가 넘친다는 안내가 나오면 내용을 줄이거나
        <strong>글자 자동 맞춤</strong>을 사용한 뒤 다시 다운로드하세요.
        이미지는 1672 × 941px로 만들어집니다.
      </p>
      <RouterLink
        class="btn btn-outline"
        :to="{ path: '/admin/schedule/image', query: { week } }"
        >스케줄 이미지 열기</RouterLink
      >
    </section>
    <section class="card guide-section" aria-labelledby="guide-memo">
      <h2 id="guide-memo" tabindex="-1">3. 주간 이미지 메모 편집·삭제하기</h2>
      <p>
        주간 이미지 메모의 달력에서 날짜를 누르면 그날의 자유로운 문구와 시간
        안내를 편집할 수 있어요. <strong>이 날짜 일정 비우기</strong>는 선택한
        하루의 내용만 비웁니다.
      </p>
      <ol>
        <li>
          저장한 한 주 전체를 지우려면 화면 아래
          <strong>저장된 주간 메모</strong> 목록에서 해당 주의
          <strong>삭제</strong>를 누릅니다. 스케줄 이미지 화면의
          <strong>이 주 저장 메모 삭제</strong>도 사용할 수 있어요.
        </li>
        <li>
          확인 창에서 7일치 내용을 확인합니다. 필요하면
          <strong>삭제 전 JSON 백업</strong>을 받아두세요.
        </li>
        <li>
          <strong>이 주 메모 삭제</strong>를 누르면 그 주의 내용·시간·꾸미기
          설정을 지웁니다. 이미지 편집기에서 삭제하는 경우 현재 미저장 입력도
          비워진다는 안내가 표시됩니다.
        </li>
      </ol>
      <p class="guide-example">
        다른 주의 메모와 일정 달력의 개별 일정은 유지됩니다. 개별 일정을
        삭제하려면 해당 일정의 수정창에서 삭제하세요.
      </p>
      <RouterLink
        class="btn btn-outline"
        :to="{ path: '/admin/schedule/notes', query: { month } }"
        >저장된 주간 메모 보기</RouterLink
      >
    </section>
    <section class="card guide-section" aria-labelledby="guide-backup">
      <h2 id="guide-backup" tabindex="-1">4. 백업 파일 만들고 불러오기</h2>
      <h3>개별 일정 백업</h3>
      <p>
        일정 달력·목록 아래의 <strong>일정 백업과 가져오기</strong>에서 이번 달
        또는 전체 일정을 JSON 파일로 받습니다. 이번 달 백업에는 현재 일정 구분
        필터가 반영돼요.
      </p>
      <p>
        가져올 때는 파일에서 <strong>일정 하나를 선택</strong>해 새 등록창에
        채웁니다. 내용을 확인하고 직접 저장하세요. 다시 저장하면 별도 일정이
        생기므로 중복 등록에 주의하세요.
      </p>
      <h3>주간 이미지 메모 백업</h3>
      <p>
        스케줄 이미지의 <strong>일정 복사와 백업</strong>에서 현재 주 또는 전체
        저장 메모를 받습니다. 현재 주 백업은 미저장 입력도 포함하고, 전체 백업은
        저장된 메모만 포함합니다.
      </p>
      <p>
        파일에서 한 주를 골라 현재 편집 주에 내용을 채운 다음 직접 저장합니다.
        <strong>개별 일정 파일과 주간 메모 파일은 서로 다른 형식</strong>이므로
        해당 화면에서 불러오세요.
      </p>
    </section>
    <section class="card guide-section" aria-labelledby="guide-drafts">
      <h2 id="guide-drafts" tabindex="-1">5. 초안 복구와 동시 수정 안내</h2>
      <p>
        편집 중 로그인이 만료되면 다시 로그인한 뒤 <strong>초안 복구</strong>를
        눌러 입력을 이어갈 수 있습니다. 초안은 같은 브라우저 탭과 계정에서 최대
        24시간 임시 보관합니다.
      </p>
      <p>
        탭을 닫거나 로그아웃하거나 브라우저가 저장을 제한하면 복구할 수 없을 수
        있어요. 오래 보관할 내용은 서버에 저장하거나 JSON 백업을 받아두세요.
      </p>
      <p>
        다른 관리자가 먼저 저장·삭제했다는 안내가 나오면 현재 입력을 확인하고
        필요하면 백업한 뒤 <strong>저장된 일정 다시 불러오기</strong> 또는
        <strong>저장된 일정 불러오기</strong>를 사용하세요. 최신 내용을 확인하고
        다시 편집합니다.
      </p>
    </section>
    <section class="card guide-section guide-faq" aria-labelledby="guide-faq">
      <h2 id="guide-faq" tabindex="-1">6. 자주 묻는 질문</h2>
      <details>
        <summary>목록에서 날짜를 골랐는데 조회하는 달은 그대로예요.</summary>
        <p>
          등록할 날짜 선택과 목록을 조회하는 달 선택은 별개입니다. 저장 전까지
          목록은 유지되고, 저장한 일정이 현재 달에 없으면 해당 달로 이동합니다.
        </p>
      </details>
      <details>
        <summary>저장했는데 일정이 안 보여요.</summary>
        <p>
          위쪽의 표시할 월과 일정 구분을 확인하세요.
          <strong>전체 구분 보기</strong> 또는 <strong>구분 해제</strong>, 특정
          날짜만 보고 있다면 <strong>월 전체 보기</strong>를 누릅니다.
        </p>
      </details>
      <details>
        <summary>주간 메모를 저장했는데 일정 목록에는 안 보여요.</summary>
        <p>
          주간 이미지 메모는 이미지 편집용 문구를 저장합니다. 일정 목록에
          표시하려면 새 일정을 등록하세요. 등록한 개별 일정은 이미지에 가져와
          사용할 수 있습니다.
        </p>
      </details>
      <details>
        <summary>이미지 파일은 받았는데 편집 내용이 사라졌어요.</summary>
        <p>
          이미지 다운로드만으로 서버에 저장되지는 않습니다. 다음에도 편집하려면
          이미지 화면의 <strong>일정 저장</strong>도 눌러주세요.
        </p>
      </details>
    </section>
    <button
      type="button"
      class="text-button guide-back-top"
      @click="jumpTo('guide-top')"
    >
      가이드 맨 위로
    </button>
  </div>
</template>
