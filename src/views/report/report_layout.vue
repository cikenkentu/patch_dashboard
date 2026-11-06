<script setup>
import { RouterLink } from 'vue-router'

// Kerangka halaman report dipakai semua domain; isi tabel tetap diberikan lewat slot.
defineProps({
  title: { type: String, required: true },
  titleId: { type: String, required: true },
  description: { type: String, default: '' },
  stateLabel: { type: String, default: '' },
})
</script>

<template>
  <section class="report-layout" :aria-labelledby="titleId">
    <RouterLink class="report-layout__back" to="/">Kembali ke dashboard</RouterLink>

    <div class="report-layout__heading">
      <div>
        <h1 :id="titleId">{{ title }}</h1>
        <p v-if="description" class="report-layout__description">{{ description }}</p>
      </div>
      <p v-if="stateLabel" class="report-layout__state" aria-live="polite">
        {{ stateLabel }}
      </p>
    </div>

    <slot />
  </section>
</template>

<style scoped>
.report-layout {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
}

.report-layout__back {
  align-self: flex-start;
  margin-bottom: 1.2rem;
  color: var(--link);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}

.report-layout__back:hover,
.report-layout__back:focus-visible {
  text-decoration: underline;
}

.report-layout__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
}

.report-layout__description,
.report-layout__state {
  color: var(--muted);
  font-size: 0.875rem;
}

.report-layout__description {
  max-width: 680px;
  margin: 0.45rem 0 0;
}

.report-layout__state {
  margin: 0.35rem 0 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .report-layout__heading {
    flex-direction: column;
    gap: 0.4rem;
  }

  .report-layout__state {
    margin-top: 0;
  }
}
</style>
