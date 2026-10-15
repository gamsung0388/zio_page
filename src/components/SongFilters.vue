<script setup>
import { computed } from "vue";
import Icon from "./Icon.vue";
import { proficiencyLabels, practiceLabels } from "../services/song-labels.js";
const props = defineProps({ filters: Object, facets: Object, admin: Boolean });
const emit = defineEmits(["update", "search", "reset"]);
const active = computed(() =>
  [
    "q",
    "proficiency",
    "practice_status",
    "genre",
    "language",
    "is_public",
  ].some((key) => props.filters[key]),
);
</script>
<template>
  <section class="filters-panel" aria-label="노래 검색과 필터">
    <label class="search-box"
      ><Icon name="search" :size="22" /><span class="sr-only"
        >곡명 또는 가수 검색</span
      ><input
        type="search"
        placeholder="어떤 노래를 찾고 있나요? 곡명 또는 가수 검색"
        :value="filters.q"
        maxlength="200"
        @input="emit('search', $event.target.value)"
    /></label>
    <div class="filter-row">
      <span class="filter-caption"><Icon name="filter" :size="17" />필터</span>
      <label
        ><span class="sr-only">숙련도 필터</span
        ><select
          :value="filters.proficiency || ''"
          @change="emit('update', 'proficiency', $event.target.value)"
        >
          <option value="">모든 숙련도</option>
          <option v-for="n in 5" :key="n" :value="n">
            {{ n }}단계 · {{ proficiencyLabels[n] }}
          </option>
        </select></label
      >
      <label
        ><span class="sr-only">연습 상태 필터</span
        ><select
          :value="filters.practice_status || ''"
          @change="emit('update', 'practice_status', $event.target.value)"
        >
          <option value="">모든 연습 상태</option>
          <option
            v-for="(label, value) in practiceLabels"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select></label
      >
      <label v-if="facets.genres.length"
        ><span class="sr-only">장르 필터</span
        ><select
          :value="filters.genre || ''"
          @change="emit('update', 'genre', $event.target.value)"
        >
          <option value="">모든 장르</option>
          <option v-for="genre in facets.genres" :key="genre">
            {{ genre }}
          </option>
        </select></label
      >
      <label v-if="facets.languages.length"
        ><span class="sr-only">언어 필터</span
        ><select
          :value="filters.language || ''"
          @change="emit('update', 'language', $event.target.value)"
        >
          <option value="">모든 언어</option>
          <option v-for="language in facets.languages" :key="language">
            {{ language }}
          </option>
        </select></label
      >
      <label v-if="admin"
        ><span class="sr-only">공개 여부 필터</span
        ><select
          :value="filters.is_public || ''"
          @change="emit('update', 'is_public', $event.target.value)"
        >
          <option value="">모든 공개 상태</option>
          <option value="true">공개</option>
          <option value="false">비공개</option>
        </select></label
      >
      <button v-if="active" class="text-button reset" @click="emit('reset')">
        초기화 <Icon name="close" :size="14" />
      </button>
    </div>
  </section>
</template>
