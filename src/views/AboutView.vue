<script setup>
import { onMounted } from "vue";
import { siteProfile, loadSiteProfile } from "../services/site-profile.js";
onMounted(() => loadSiteProfile().catch(() => {}));
</script>
<template>
  <section class="about-layout card">
    <div class="about-photo">
      <img src="/images/zio-reference.png" alt="지오 캐릭터" />
    </div>
    <div class="about-copy">
      <span class="eyebrow">ABOUT ZIO</span>
      <h1>안녕, 지오예요 ♡</h1>
      <p class="profile-multiline">{{ siteProfile.about_text }}</p>
      <div class="profile-social-links">
        <a
          v-for="link in siteProfile.social_links"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="button secondary"
          >{{ link.label }} ↗</a
        >
      </div>
      <a
        class="btn btn-primary"
        :href="siteProfile.soop_url"
        target="_blank"
        rel="noopener noreferrer"
        >SOOP 방송국 바로가기 ↗</a
      >
    </div>
  </section>
</template>
