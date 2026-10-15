<script setup>
import { ref, onMounted } from "vue";
import { api } from "../services/api.js";
import { formatNumber, proficiencyLabels } from "../services/song-labels.js";
import Panda from "../components/Panda.vue";
import Icon from "../components/Icon.vue";
import Notice from "../components/Notice.vue";
import SongList from "../components/SongList.vue";
const songs = ref([]),
  total = ref(0),
  loading = ref(true),
  error = ref("");
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api("/songs?page_size=5&sort=recent");
    songs.value = data.items;
    total.value = data.pagination.total;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="container home-page">
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">
          <span class="tiny-star">✳</span> A LITTLE HOME FOR MUSIC
        </div>
        <h1>지오의 노래가<br /><span>머무는 곳.</span></h1>
        <p>
          좋아하는 노래를 찾고, 새로운 노래를 만나고.<br />함께 듣는 즐거움이
          차곡차곡 쌓이는 공간이에요.
        </p>
        <RouterLink class="button primary" to="/songs"
          ><Icon name="book" :size="20" />노래책자 둘러보기<Icon
            name="arrow"
            :size="19"
        /></RouterLink>
        <div class="hero-footnote">
          <span class="green-dot"></span>당신의 오늘에, 노래 한 곡
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="art-label">ZIO'S MUSIC ROOM</span>
        <div class="art-orbit orbit-one"></div>
        <div class="art-orbit orbit-two"></div>
        <span class="music-note note-one">♪</span
        ><span class="music-note note-two">♫</span
        ><span class="art-spark spark-one">✦</span
        ><span class="art-spark spark-two">✳</span>
        <div class="record">
          <div class="record-center"><Icon name="music" :size="24" /></div>
        </div>
        <div class="panda-wrap"><Panda /></div>
        <div class="art-ticket">
          <span class="green-dot"></span>play a little, smile a lot.
        </div>
        <div class="art-leaf leaf-one"><Icon name="leaf" :size="54" /></div>
        <div class="art-leaf leaf-two"><Icon name="leaf" :size="38" /></div>
      </div>
    </section>
    <section class="home-songbook-banner">
      <div class="banner-icon"><Icon name="book" :size="27" /></div>
      <div>
        <strong>오늘은 어떤 노래가 듣고 싶나요?</strong>
        <p>곡명, 가수, 숙련도로 원하는 노래를 찾아보세요.</p>
      </div>
      <RouterLink to="/songs" class="text-button"
        >노래 찾아보기<Icon name="arrow" :size="19"
      /></RouterLink>
    </section>
    <section class="recent-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">FRESH FROM THE SONGBOOK</span>
          <h2>
            새로 담은 노래
            <span v-if="!loading && !error" class="count-chip">{{
              formatNumber(total)
            }}</span>
          </h2>
        </div>
        <RouterLink to="/songs" class="text-button"
          >전체 보기<Icon name="arrow" :size="17"
        /></RouterLink>
      </div>
      <div class="recent-content">
        <Notice
          :loading="loading"
          :error="error"
          :empty="!songs.length"
          title="첫 번째 노래를 기다리고 있어요"
          message="지오의 노래책자가 채워지면, 가장 새로운 노래를 여기서 만나보세요."
          @retry="load"
        /><SongList v-if="!loading && !error && songs.length" :songs="songs" />
      </div>
    </section>
    <section class="home-guide">
      <div>
        <span class="eyebrow">A SMALL GUIDE</span>
        <h2>노래책자, 이렇게 읽어요.</h2>
        <p>노래를 고르기 전에 가볍게 확인해보세요.</p>
      </div>
      <div class="guide-card">
        <span class="guide-number">01</span>
        <h3>얼마나 익숙한 노래일까?</h3>
        <p>
          숙련도는 1단계부터 5단계까지.<br />노래마다 익숙한 정도를 확인해요.
        </p>
        <div class="guide-levels">
          <span v-for="n in 5" :key="n" :title="proficiencyLabels[n]">{{
            n
          }}</span
          ><small>연습 필요 → 완곡 가능</small>
        </div>
      </div>
      <div class="guide-card">
        <span class="guide-number">02</span>
        <h3>신청하기 전에 확인해요</h3>
        <p>
          곡마다 필요한 풍 개수가 표시돼요.<br />신청은 방송의 안내를
          따라주세요.
        </p>
        <span class="guide-balloon"
          ><Icon name="balloon" :size="18" />필요 풍 개수 안내</span
        >
      </div>
    </section>
  </div>
</template>
