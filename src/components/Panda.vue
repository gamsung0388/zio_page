<script setup>
defineProps({ decorative: { type: Boolean, default: true } });
</script>
<template>
  <svg
    viewBox="0 0 240 230"
    :aria-hidden="decorative"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : '음악을 듣는 판다'"
    class="panda"
  >
    <ellipse cx="120" cy="218" rx="76" ry="9" fill="#163d2c" opacity=".12" />
    <ellipse cx="120" cy="173" rx="61" ry="47" fill="#243e33" />
    <ellipse cx="120" cy="173" rx="42" ry="40" fill="#fffcf1" />
    <ellipse
      cx="69"
      cy="199"
      rx="29"
      ry="21"
      fill="#243e33"
      transform="rotate(-20 69 199)"
    />
    <ellipse
      cx="171"
      cy="199"
      rx="29"
      ry="21"
      fill="#243e33"
      transform="rotate(20 171 199)"
    />
    <circle cx="60" cy="49" r="28" fill="#243e33" />
    <circle cx="180" cy="49" r="28" fill="#243e33" />
    <circle cx="60" cy="49" r="14" fill="#506b57" />
    <circle cx="180" cy="49" r="14" fill="#506b57" />
    <ellipse cx="120" cy="99" rx="89" ry="77" fill="#fffcf1" />
    <ellipse
      cx="83"
      cy="91"
      rx="24"
      ry="30"
      fill="#243e33"
      transform="rotate(26 83 91)"
    />
    <ellipse
      cx="157"
      cy="91"
      rx="24"
      ry="30"
      fill="#243e33"
      transform="rotate(-26 157 91)"
    />
    <path
      d="M74 93q9-10 18 0m56 0q9-10 18 0"
      fill="none"
      stroke="#fffcf1"
      stroke-width="5"
      stroke-linecap="round"
    />
    <ellipse cx="61" cy="117" rx="14" ry="7" fill="#f1bea5" opacity=".8" />
    <ellipse cx="179" cy="117" rx="14" ry="7" fill="#f1bea5" opacity=".8" />
    <path d="M110 117q10-6 20 0l-10 9Z" fill="#243e33" />
    <path
      d="M120 125v7m0 0q-10 10-17 0m17 0q10 10 17 0"
      stroke="#243e33"
      stroke-width="3"
      fill="none"
      stroke-linecap="round"
    />
    <path
      d="M31 89C20 13 218 5 211 89"
      fill="none"
      stroke="#69967a"
      stroke-width="10"
    />
    <rect x="21" y="80" width="19" height="43" rx="9" fill="#235c46" />
    <rect x="200" y="80" width="19" height="43" rx="9" fill="#235c46" />
    <path
      d="m82 174 24 12m52-12-24 12"
      fill="none"
      stroke="#243e33"
      stroke-width="24"
      stroke-linecap="round"
    />
    <path d="M105 175h30v30h-30Z" fill="#e5c77f" />
    <path
      d="M119 183v12m-4-3 4 3 6-7"
      fill="none"
      stroke="#7c662f"
      stroke-width="2"
    />
  </svg>
</template>
