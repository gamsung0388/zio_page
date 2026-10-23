<template>
  <nav class="site-settings-tabs" aria-label="홈페이지 설정">
    <RouterLink
      to="/admin/site"
      :aria-current="$route.path === '/admin/site' ? 'page' : undefined"
      >기본 정보</RouterLink
    >
    <RouterLink
      to="/admin/menus"
      :aria-current="$route.path === '/admin/menus' ? 'page' : undefined"
      >메뉴 구성</RouterLink
    >
    <RouterLink
      to="/admin/appearance"
      :aria-current="$route.path === '/admin/appearance' ? 'page' : undefined"
      >테마 설정</RouterLink
    >
  </nav>
</template>
