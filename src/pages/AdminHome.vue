<script setup>
import { session } from "../services/api.js";
import Icon from "../components/Icon.vue";
const entries = [
  {
    to: "/admin/users",
    title: "관리자 관리",
    description: "관리자 목록을 확인하고 새 관리자를 등록하세요.",
    icon: "plus",
  },
  {
    to: "/admin/password-reset",
    title: "관리자 비밀번호 초기화",
    description: "초기화할 관리자 계정을 선택하세요.",
    icon: "lock",
  },
  {
    to: "/admin/password",
    title: "관리자 비밀번호 변경",
    description: "내 계정의 현재 비밀번호를 변경하세요.",
    icon: "edit",
  },
];
</script>
<template>
  <div class="container page admin-home-page">
    <div class="breadcrumb">
      <RouterLink to="/">홈</RouterLink><span>/</span>관리자 관리 메뉴
    </div>
    <div class="page-heading">
      <div>
        <span class="eyebrow">ZIO HOME ADMIN</span>
        <h1>관리자 관리 메뉴<span class="green-period">.</span></h1>
        <p>{{ session.user?.display_name || session.user?.username }}님, 관리자 계정을 관리할 메뉴를 선택해주세요.</p>
      </div>
    </div>
    <nav class="admin-menu-grid" aria-label="관리 기능 선택">
      <RouterLink
        v-for="entry in entries"
        :key="entry.to"
        :to="entry.to"
        :aria-label="entry.title"
        class="admin-menu-card"
      >
        <span class="admin-menu-icon"><Icon :name="entry.icon" :size="23" /></span>
        <div><h2>{{ entry.title }}</h2><p>{{ entry.description }}</p></div>
        <Icon name="arrow" :size="18" />
      </RouterLink>
    </nav>
  </div>
</template>
