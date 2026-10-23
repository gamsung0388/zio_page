<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { api } from "../services/api.js";
import { testAlbumSearch } from "../services/album-lab.js";
import { validateAlbum } from "../../shared/album.js";
import AlbumSource from "../components/AlbumSource.vue";
import CoverImage from "../components/CoverImage.vue";
import "../styles/album-lab.css";
const ready = ref(false),
  busy = ref(false),
  error = ref(""),
  q = ref("검은행복"),
  country = ref("US"),
  mode = ref("browser"),
  report = ref(null),
  items = ref([]),
  selected = ref(null);
let controller,
  sequence = 0;
function clear() {
  sequence++;
  controller?.abort();
  busy.value = false;
  report.value = null;
  items.value = [];
  selected.value = null;
  error.value = "";
}
watch([q, country, mode], clear);
onBeforeUnmount(clear);
onMounted(async () => {
  try {
    await api("/admin/album-lab");
    ready.value = true;
  } catch (e) {
    error.value = e.message;
  }
});
async function search() {
  if (!ready.value || busy.value) return;
  controller?.abort();
  controller = new AbortController();
  const ticket = ++sequence;
  busy.value = true;
  error.value = "";
  items.value = [];
  report.value = null;
  selected.value = null;
  try {
    const data = await testAlbumSearch(
      { q: q.value, country: country.value },
      mode.value,
      controller.signal,
    );
    if (ticket !== sequence) return;
    report.value = data;
    items.value = data.items;
  } catch (e) {
    if (ticket === sequence && e.name !== "AbortError") error.value = e.message;
  } finally {
    if (ticket === sequence) busy.value = false;
  }
}
function choose(item) {
  selected.value = validateAlbum(item);
}
</script>
<template>
  <div class="album-lab">
    <div class="page-toolbar">
      <a class="back-link" href="/admin/songs">← 노래 관리로</a
      ><span class="lab-pill">개인 실험실</span>
    </div>
    <section class="page-intro">
      <div>
        <span class="eyebrow">ALBUM LAB</span>
        <h1>앨범 연결 실험실</h1>
        <p>검색하고, 표지를 골라 연결될 모습을 확인해요.</p>
      </div>
    </section>
    <p class="lab-notice">
      테스트 전용 공간이에요. 선택한 앨범은 운영 노래에 저장되지 않으며 페이지를
      나가면 지워져요.
    </p>
    <form
      class="card lab-search"
      aria-label="앨범 연결 테스트"
      @submit.prevent="search"
    >
      <fieldset :disabled="!ready || busy">
        <legend class="sr-only">검색 조건</legend>
        <div class="lab-fields">
          <label class="field"
            >곡명·가수<input
              v-model="q"
              maxlength="200"
              required
              placeholder="예: 검은행복 윤미래" /></label
          ><label class="field"
            >검색 국가<select v-model="country" aria-label="검색 국가">
              <option value="US">미국</option>
              <option value="KR">한국</option>
              <option value="JP">일본</option>
            </select></label
          >
        </div>
        <fieldset class="lab-modes">
          <legend>검색 방식</legend>
          <label
            ><input v-model="mode" type="radio" value="browser" /> 내
            브라우저에서 직접</label
          ><label
            ><input v-model="mode" type="radio" value="worker" /> 홈페이지
            서버를 거쳐서</label
          >
        </fieldset>
        <p class="help-text">
          미국 검색에서도 한국 곡을 찾을 수 있어요. 같은 검색어로 두 방식을
          비교해보세요.
        </p>
        <button
          class="button primary"
          type="submit"
          :disabled="!q.trim() || !ready || busy"
        >
          {{ busy ? "검색 중…" : "앨범 검색 테스트" }}
        </button>
      </fieldset>
      <button v-if="busy" type="button" class="button secondary" @click="clear">
        검색 취소
      </button>
    </form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <section
      v-if="report"
      class="card lab-report"
      aria-label="테스트 결과"
      role="status"
    >
      <strong>{{ report.ok ? "연결 성공" : "연결 확인 필요" }}</strong
      ><span
        >{{ mode === "browser" ? "내 브라우저" : "홈페이지 서버" }} ·
        {{
          report.upstream_status
            ? "HTTP " + report.upstream_status
            : "응답 없음"
        }}
        · {{ report.elapsed_ms }}ms</span
      >
      <p>
        {{
          report.ok
            ? items.length
              ? items.length +
                "개의 음원을 찾았어요. 원곡·라이브·반주를 확인하고 골라주세요."
              : "검색 결과가 없어요. 검색 국가나 띄어쓰기를 바꿔보세요."
            : report.message
        }}
      </p>
    </section>
    <section
      v-if="selected"
      class="card lab-selected"
      aria-label="앨범 연결 미리보기"
    >
      <h2>이렇게 연결돼요</h2>
      <div class="lab-selected-body">
        <CoverImage
          :src="selected.artwork_url"
          :alt="selected.album_title + ' 선택한 표지'"
          eager
        />
        <div>
          <h3>{{ selected.title }}</h3>
          <p>{{ selected.artist }}</p>
          <AlbumSource :album="selected" />
          <p class="help-text">현재 선택은 이 테스트 화면에만 적용돼요.</p>
          <button
            type="button"
            class="button secondary"
            @click="selected = null"
          >
            테스트 연결 해제
          </button>
        </div>
      </div>
    </section>
    <div class="lab-results" aria-label="앨범 검색 후보">
      <article
        v-for="item in items"
        :key="item.track_id"
        class="card lab-candidate"
      >
        <CoverImage
          :src="item.artwork_url"
          :alt="item.album_title + ' 앨범 표지'"
        />
        <div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.artist }}</p>
          <AlbumSource :album="item" /><button
            type="button"
            class="button secondary"
            :aria-label="item.title + ' 연결 미리보기'"
            @click="choose(item)"
          >
            연결 미리보기
          </button>
        </div>
      </article>
    </div>
  </div>
</template>
