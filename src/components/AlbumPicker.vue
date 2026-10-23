<script setup>
import AlbumSource from "./AlbumSource.vue";
defineProps({
  modelValue: Object,
  title: String,
  artist: String,
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
</script>
<template>
  <section class="album-editor" aria-label="앨범 연결">
    <div class="album-editor-heading">
      <div>
        <h2>앨범 연결 <small class="help-text">준비 중</small></h2>
        <p>
          외부 앨범 검색은 잠시 쉬고 있어요. 위에서 앨범 사진을 직접
          등록해주세요.
        </p>
      </div>
    </div>
    <div v-if="modelValue" class="album-selected">
      <img
        :src="modelValue.artwork_url"
        :alt="modelValue.album_title + ' 앨범 표지'"
        width="88"
        height="88"
      />
      <div>
        <strong>{{ modelValue.title }}</strong>
        <p>{{ modelValue.artist }}</p>
        <AlbumSource :album="modelValue" /><button
          type="button"
          class="button secondary"
          :disabled="disabled"
          @click="emit('update:modelValue', null)"
        >
          앨범 연결 해제
        </button>
      </div>
    </div>
    <p v-if="modelValue" class="help-text">
      기존 연결 정보는 유지돼요. 직접 등록한 사진이 있으면 먼저 표시해요.
    </p>
  </section>
</template>
