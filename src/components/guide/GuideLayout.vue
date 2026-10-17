<script setup>
import { ref } from "vue";
import Icon from "../Icon.vue";
import "../../styles/guide.css";

defineProps({
  title: String,
  description: String,
  eyebrow: String,
  sections: { type: Array, required: true },
  steps: { type: Array, required: true },
  returnTo: { type: [String, Object], required: true },
  returnLabel: { type: String, default: "목록으로 돌아가기" },
});
const root = ref(null);
function jumpTo(id) {
  const heading = root.value?.querySelector(`#${id}`);
  heading?.focus({ preventScroll: true });
  heading?.scrollIntoView({ block: "start" });
}
</script>

<template>
  <div ref="root" class="reading-guide">
    <header class="reading-guide-hero">
      <div>
        <span class="eyebrow">{{ eyebrow }}</span>
        <h1 id="reading-guide-top" tabindex="-1">{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <div class="reading-guide-actions">
        <slot name="actions" />
        <RouterLink class="btn btn-outline" :to="returnTo">
          <Icon name="back" :size="17" />{{ returnLabel }}
        </RouterLink>
      </div>
    </header>
    <ol class="reading-guide-steps" aria-label="간단한 이용 순서">
      <li v-for="(step, index) in steps" :key="step.title">
        <span class="reading-guide-step-number" aria-hidden="true"
          >0{{ index + 1 }}</span
        >
        <div>
          <h2>{{ step.title }}</h2>
          <p>{{ step.text }}</p>
        </div>
      </li>
    </ol>
    <nav class="reading-guide-toc" aria-label="가이드 목차">
      <span><Icon name="book" :size="19" />궁금한 내용 바로 찾기</span>
      <div>
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          @click="jumpTo(section.id)"
        >
          {{ section.label }}<Icon name="down" :size="14" />
        </button>
      </div>
    </nav>
    <section
      v-for="(section, index) in sections"
      :key="section.id"
      class="card reading-guide-section"
      :aria-labelledby="section.id"
    >
      <h2 :id="section.id" tabindex="-1">
        <span aria-hidden="true">{{ String(index + 1).padStart(2, "0") }}</span
        >{{ section.title }}
      </h2>
      <slot :name="section.id" />
    </section>
    <footer class="reading-guide-footer">
      <RouterLink class="btn btn-primary" :to="returnTo"
        >{{ returnLabel }}<Icon name="arrow" :size="17"
      /></RouterLink>
      <button
        class="text-button"
        type="button"
        @click="jumpTo('reading-guide-top')"
      >
        가이드 맨 위로<Icon name="up" :size="17" />
      </button>
    </footer>
  </div>
</template>
