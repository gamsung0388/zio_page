<script setup>
import "../styles/management.css";
import { computed } from "vue";
import { session } from "../services/api.js";
import { siteMenus } from "../services/useSiteNavigation.js";
import { administrationLinks } from "../services/admin-navigation.js";
import { menuPresentation } from "../../shared/navigation.js";
import Icon from "../components/Icon.vue";
import MenuLink from "../components/MenuLink.vue";
const work = computed(() =>
  siteMenus.value
    .filter((item) => item.area === "work" && item.visible)
    .map(menuPresentation),
);
</script>
<template>
  <div class="management-page administration-home">
    <header class="management-welcome">
      <div class="management-welcome-copy">
        <span class="management-kicker">지오의 작은 운영실</span>
        <h1>우리 공간을<br />함께 가꿔요<span>.</span></h1>
        <p>
          {{ session.user?.display_name || session.user?.username }}님,
          반가워요.<br />사람과 메뉴를 살피는 일은 이곳에서 시작해요.
        </p>
        <div class="management-welcome-tag"><span></span>관리</div>
      </div>
      <div class="management-welcome-art" aria-hidden="true">
        <div class="welcome-orbit"></div>
        <Icon name="leaf" :size="84" /><img
          src="/images/zio-reference.png"
          alt=""
        /><span>매일 조금씩, 더 좋은 공간으로</span>
      </div>
    </header>
    <section class="management-section">
      <div class="management-section-title">
        <div>
          <span class="management-kicker">공간을 돌보는 두 가지 방법</span>
          <h2>무엇을 정리할까요?</h2>
        </div>
        <span class="management-section-caption"
          >계정과 화면 구성을 나누어 관리해요</span
        >
      </div>
      <nav class="management-feature-grid" aria-label="관리 기능 선택">
        <RouterLink
          v-for="entry in administrationLinks"
          :key="entry.id"
          :to="entry.href"
          :aria-label="entry.label"
          class="management-feature"
          :class="entry.id"
          ><div class="management-feature-top">
            <span class="management-feature-icon"
              ><Icon :name="entry.icon" :size="25" /></span
            ><span class="management-feature-arrow"
              ><Icon name="arrow" :size="20"
            /></span>
          </div>
          <h3>{{ entry.label }}</h3>
          <p>{{ entry.description }}</p>
          <span class="management-feature-detail">{{
            entry.id === "accounts"
              ? "관리자 목록 · 등록 · 비밀번호"
              : "이름 · 순서 · 링크 추가 · 테마"
          }}</span></RouterLink
        >
      </nav>
    </section>
    <section v-if="work.length" class="management-workspace">
      <div>
        <span class="management-kicker">매일의 운영은 따로, 더 가볍게</span>
        <h2>노래와 일정 작업을 이어가세요</h2>
        <p>콘텐츠를 다루는 메뉴는 ‘운영’에 모아 두었어요.</p>
      </div>
      <div class="management-work-links">
        <MenuLink
          v-for="item in work"
          :key="item.id"
          :item="item"
          class="management-work-link"
        />
      </div>
    </section>
    <div class="management-gentle-note">
      <Icon name="leaf" :size="19" /><span
        >하나씩 정리해도 괜찮아요. 필요한 일부터 시작해보세요.</span
      >
    </div>
  </div>
</template>
