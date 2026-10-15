<script setup>
import { proficiencyLabels, practiceLabels } from "../services/song-labels.js";
defineProps({ song: Object });
</script>
<template>
  <span
    class="proficiency"
    :aria-label="`숙련도 ${song.proficiency}단계 ${proficiencyLabels[song.proficiency]}`"
  >
    <span class="level-bars" aria-hidden="true"
      ><i v-for="n in 5" :key="n" :class="{ filled: n <= song.proficiency }"></i
    ></span>
    <span>{{ proficiencyLabels[song.proficiency] }}</span>
  </span>
  <span class="badge" :class="`status-${song.practice_status}`"
    ><span class="badge-dot"></span
    >{{ practiceLabels[song.practice_status] }}</span
  >
</template>
