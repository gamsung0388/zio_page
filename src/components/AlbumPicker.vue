<script setup>
import { ref, onBeforeUnmount, watch } from "vue";
import { api } from "../services/api.js";
import Modal from "./Modal.vue";
import CoverImage from "./CoverImage.vue";
import AlbumSource from "./AlbumSource.vue";
defineProps({
  modelValue: Object,
  title: String,
  artist: String,
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
const open = ref(false),
  q = ref(""),
  country = ref("US"),
  items = ref([]),
  busy = ref(false),
  error = ref(""),
  searched = ref(false);
let controller,
  sequence = 0;
function show(title, artist) {
  q.value = Array.from((title + " " + artist).trim())
    .slice(0, 200)
    .join("");
  open.value = true;
}
function cancel() {
  sequence++;
  controller?.abort();
  busy.value = false;
}
watch([q, country], () => {
  cancel();
  items.value = [];
  searched.value = false;
  error.value = "";
});
async function search() {
  cancel();
  const current = sequence;
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  searched.value = false;
  try {
    const data = await api("/admin/catalog/search", {
      method: "POST",
      body: { q: q.value, country: country.value },
      signal: controller.signal,
    });
    if (current === sequence) {
      items.value = data.items;
      searched.value = true;
    }
  } catch (e) {
    if (current === sequence && e.name !== "AbortError")
      error.value = e.message;
  } finally {
    if (current === sequence) busy.value = false;
  }
}
function choose(album) {
  emit("update:modelValue", album);
  cancel();
  open.value = false;
}
function close() {
  cancel();
  open.value = false;
}
onBeforeUnmount(cancel);
</script>
<template>
  <section class="album-editor" aria-label="앨범 연결">
    <div class="album-editor-heading">
      <div>
        <h2>앨범 연결</h2>
        <p>원곡의 표지와 공식 음원 링크를 함께 담아요.</p>
      </div>
      <button
        type="button"
        class="button secondary"
        :disabled="disabled"
        @click="show(title, artist)"
      >
        {{ modelValue ? "앨범 변경" : "앨범 찾기" }}
      </button>
    </div>
    <div v-if="modelValue" class="album-selected">
      <CoverImage
        :src="modelValue.artwork_url"
        :alt="modelValue.album_title + ' 앨범 표지'"
      />
      <div>
        <strong>{{ modelValue.title }}</strong>
        <p>{{ modelValue.artist }}</p>
        <AlbumSource :album="modelValue" /><button
          type="button"
          class="text-button"
          :disabled="disabled"
          @click="emit('update:modelValue', null)"
        >
          앨범 연결 해제
        </button>
      </div>
    </div>
    <p v-else class="help-text">
      연결하지 않으면 기본 커버를 사용해요. 검색 결과를 선택해도
      곡명·숙련도·메모는 바뀌지 않습니다.
    </p>
    <Modal v-if="open" title="앨범 찾기" wide @close="close">
      <p class="modal-intro">
        원곡·라이브·반주 버전을 확인하고 선택해주세요. 미국 검색에서 한국 곡도
        찾을 수 있어요.
      </p>
      <div class="catalog-search">
        <label class="field"
          >앨범 검색어<input
            v-model="q"
            maxlength="200"
            @keydown.enter.prevent="search" /></label
        ><label class="field"
          >검색 국가<select v-model="country">
            <option value="US">미국</option>
            <option value="KR">한국</option>
            <option value="JP">일본</option>
          </select></label
        ><button
          type="button"
          class="button primary"
          :disabled="busy || !q.trim()"
          @click="search"
        >
          {{ busy ? "검색 중…" : "검색" }}
        </button>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-else-if="searched && !items.length" role="status">
        검색 결과가 없어요. 국가나 곡명·가수를 바꿔 다시 찾아보세요.
      </p>
      <div class="catalog-results" :aria-busy="busy">
        <article v-for="album in items" :key="album.track_id">
          <CoverImage
            :src="album.artwork_url"
            :alt="album.album_title + ' 앨범 표지'"
          />
          <div>
            <strong>{{ album.title }}</strong>
            <p>{{ album.artist }}</p>
            <AlbumSource :album="album" /><button
              type="button"
              class="button secondary"
              :aria-label="album.title + ' 앨범 연결'"
              @click="choose(album)"
            >
              이 앨범 연결
            </button>
          </div>
        </article>
      </div>
      <p class="help-text">선택한 표지와 공식 링크는 노래 저장 후 반영돼요.</p>
    </Modal>
  </section>
</template>
