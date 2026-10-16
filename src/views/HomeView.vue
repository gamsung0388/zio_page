<script setup>
import Notice from "../components/Notice.vue";
import SongCard from "../components/SongCard.vue";
defineProps({
  songs: { type: Array, default: () => [] },
  connected: Boolean,
  loading: Boolean,
  error: String,
});
const emit = defineEmits(["navigate", "open", "retry"]);
</script>

<template>
  <section class="home-hero">
    <div class="home-hero-copy">
      <span class="eyebrow hero-eyebrow">✦ ZIO'S LITTLE MUSIC SPACE</span>
      <h1>지오의 작은<br /><em>음악 공간</em></h1>
      <p>
        좋은 노래로, 오늘도 함께해요.<br />지오의 노래와 방송 이야기를
        만나보세요.
      </p>
      <div class="hero-actions">
        <component
          :is="connected ? 'RouterLink' : 'button'"
          :to="connected ? '/songs' : undefined"
          class="btn btn-primary"
          type="button"
          @click="emit('navigate', '#/songs')"
          >♫ 노래책자 둘러보기 <span>→</span></component
        >
        <a
          class="btn btn-hero-outline"
          href="https://www.sooplive.com/station/bluejin0129"
          target="_blank"
          rel="noopener noreferrer"
          >방송국 바로가기 ↗</a
        >
      </div>
    </div>
    <div class="hero-image-wrap">
      <img
        src="/images/zio-reference.png"
        alt="검은 긴 머리와 초록빛 눈의 지오 캐릭터"
      />
    </div>
    <span class="hero-glint" aria-hidden="true">✧</span>
  </section>

  <section class="home-section">
    <div class="section-heading">
      <div>
        <span class="eyebrow">ZIO SONGBOOK</span>
        <h2>지오의 노래책자 <span class="heading-sprout">✿</span></h2>
        <p>어떤 노래를 부를지 함께 골라볼까요?</p>
      </div>
      <button
        class="text-link"
        type="button"
        @click="emit('navigate', '#/songs')"
      >
        전체 보기 →
      </button>
    </div>
    <Notice
      v-if="connected"
      :loading="loading"
      :error="error"
      :empty="!songs.length"
      title="첫 번째 노래를 기다리고 있어요"
      message="노래가 등록되면 이곳에서 만날 수 있어요."
      @retry="emit('retry')"
    />
    <div v-if="!loading && !error && songs.length" class="home-song-list">
      <SongCard
        v-for="song in songs.slice(0, 4)"
        :key="song.id"
        :song="song"
        :to="connected ? '/songs/' + song.id : undefined"
        compact
        @open="emit('open', $event)"
      />
    </div>
  </section>

  <div class="home-two-col">
    <section class="home-soft-card">
      <span class="eyebrow">HELLO, ZIO</span>
      <h2>지오를 소개해요 ♡</h2>
      <p>
        검은 긴 머리와 초록빛 눈, 노래하는 시간을 좋아하는 지오의 공간이에요.
      </p>
      <button
        class="text-link"
        type="button"
        @click="emit('navigate', '#/about')"
      >
        소개 보러 가기 →
      </button>
    </section>
    <section class="home-soft-card home-soft-card-green">
      <span class="eyebrow">ON SOOP</span>
      <h2>지금, 지오와 함께</h2>
      <p>
        오늘도 지오의 방송국에서 만나요. 방송 여부는 SOOP에서 확인할 수 있어요.
      </p>
      <a
        class="text-link"
        href="https://www.sooplive.com/station/bluejin0129"
        target="_blank"
        rel="noopener noreferrer"
        >SOOP 방송국 ↗</a
      >
    </section>
  </div>
</template>
