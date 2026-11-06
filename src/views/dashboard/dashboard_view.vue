<script setup>
import DashboardCu from './dashboard_cu.vue'
import DashboardSlot2 from './dashboard_slot2.vue'
import DashboardSlot3 from './dashboard_slot3.vue'
import DashboardSlot4 from './dashboard_slot4.vue'
import DashboardSlot5 from './dashboard_slot5.vue'
import DashboardSlot6 from './dashboard_slot6.vue'
</script>

<template>
  <section class="dashboard-page" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title" class="dashboard-heading">Dashboard</h1>

    <!-- Hanya CU memiliki detail status; slot lain tetap sebagai preview doughnut kosong. -->
    <div class="dashboard-grid">
      <DashboardCu />
      <DashboardSlot2 />
      <DashboardSlot3 />
      <DashboardSlot4 />
      <DashboardSlot5 />
      <DashboardSlot6 />
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
  min-width: 0;
}

.dashboard-heading {
  margin-bottom: 1.25rem;
}

/* Tiga kolom menghasilkan dua baris penuh; breakpoint menjaga doughnut tetap terbaca. */
.dashboard-grid {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  align-items: stretch;
  gap: 1.25rem;
}

.dashboard-grid > * {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 1100px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .dashboard-grid {
    grid-auto-rows: auto;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
}
</style>
