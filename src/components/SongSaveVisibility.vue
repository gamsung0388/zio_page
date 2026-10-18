<script setup>
import Icon from "./Icon.vue";
defineProps({ isPublic: Boolean, editing: Boolean });
</script>
<template>
  <div
    class="song-save-visibility"
    :class="{ 'is-private': !isPublic }"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <Icon :name="isPublic ? 'book' : 'lock'" :size="20" />
    <div>
      <strong>{{
        isPublic
          ? editing
            ? "공개로 수정돼요"
            : "공개로 등록돼요"
          : "관리자에게만 보여요"
      }}</strong>
      <p>
        {{
          isPublic
            ? "방문자에게 노래 정보가 보여요. 지오 메모는 관리자 전용이에요."
            : "공개 노래책자에는 표시되지 않아요. 준비되면 공개로 바꿀 수 있어요."
        }}
      </p>
    </div>
  </div>
</template>
