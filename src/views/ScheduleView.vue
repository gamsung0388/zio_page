<script setup>
defineEmits(["songs"]);
</script>
<template>
  <section class="placeholder-page card">
    <span class="placeholder-icon">▦</span
    ><span class="eyebrow">COMING IN PHASE 2</span>
    <h1>방송 일정표</h1>
    <p>
      방송 일정표는 2차 개발에서 연결할 공간이에요.<br />지금은 메뉴와 전체
      레이아웃만 준비했어요.
    </p>
    <button class="btn btn-primary" type="button" @click="$emit('songs')">
      노래책자 보러 가기 →
    </button>
  </section>
</template>
