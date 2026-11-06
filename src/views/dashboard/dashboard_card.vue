<script setup>
// Shell visual bersama: domain memasok item, sedangkan card menjaga layout ringkasan tetap konsisten.
const props = defineProps({
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  hasData: { type: Boolean, default: false },
  detailsInteractive: { type: Boolean, default: false },
  detailsLabel: { type: String, default: '' },
})

const emit = defineEmits(['select-item'])
const numberFormatter = new Intl.NumberFormat('id-ID')

function formatValue(value) {
  return Number.isFinite(value) ? numberFormatter.format(value) : String(value ?? '—')
}

function selectItem(item) {
  if (props.detailsInteractive && props.hasData) emit('select-item', item.key)
}
</script>

<template>
  <article class="dashboard-card">
    <h2 class="dashboard-card__title">{{ title }}</h2>

    <div class="dashboard-card__body">
      <slot />
    </div>

    <div v-if="$slots.details || items.length" class="dashboard-card__details">
      <slot name="details">
        <!-- Seluruh domain memakai row yang sama; label, warna, dan nilai tetap berasal dari file domain. -->
        <div
          class="dashboard-card__summary"
          role="group"
          :aria-label="detailsLabel || `Ringkasan ${title}`"
        >
          <button
            v-for="item in items"
            :key="item.key"
            type="button"
            :disabled="!detailsInteractive || !hasData"
            :aria-label="`${item.label}, ${hasData ? formatValue(item.value) : 'data belum tersedia'}`"
            @click="selectItem(item)"
          >
            <span class="dashboard-card__item-label">
              <span
                class="dashboard-card__item-dot"
                :style="{ backgroundColor: item.color }"
                aria-hidden="true"
              ></span>
              <span class="dashboard-card__item-text">{{ item.label }}</span>
            </span>
            <strong>{{ hasData ? formatValue(item.value) : '—' }}</strong>
          </button>
        </div>
      </slot>
    </div>
  </article>
</template>

<style scoped>
.dashboard-card {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  max-width: 100%;
  grid-template-rows: auto minmax(14.5rem, 1fr) auto;
  overflow: hidden;
  padding: 1rem;
  border: 1px solid var(--border);
  background: var(--surface);
}

.dashboard-card__title {
  overflow: hidden;
  font-size: 1rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-card__body {
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: center;
  padding-top: 0.5rem;
}

.dashboard-card__details {
  width: 100%;
  min-width: 0;
  /* Lima row compact terlihat penuh; overflow baru muncul mulai item keenam/label ekstrem. */
  max-height: 13rem;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  border-top: 1px solid var(--border-light);
}

.dashboard-card__summary button {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.4rem;
  border: 0;
  border-bottom: 1px solid var(--border-light);
  color: var(--text);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.dashboard-card__summary button:not(:disabled):hover,
.dashboard-card__summary button:focus-visible {
  background: #f2f4f7;
}

.dashboard-card__summary button:focus-visible {
  outline: 2px solid var(--link);
  outline-offset: -2px;
}

.dashboard-card__summary button:disabled {
  cursor: default;
}

.dashboard-card__item-label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.dashboard-card__item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-card__item-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.dashboard-card__summary strong {
  flex: 0 0 auto;
  color: var(--text);
  font-size: 1rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 430px) {
  .dashboard-card {
    padding: 1.1rem;
  }

  .dashboard-card__body {
    min-height: 14.5rem;
  }

  .dashboard-card__details {
    max-height: 14rem;
  }

  .dashboard-card__summary button {
    min-height: 44px;
  }
}
</style>
