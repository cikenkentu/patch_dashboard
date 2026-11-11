<script setup>
// Page ini adalah composition root visual: urutan import/markup menentukan urutan kartu.
// Fetch dan aturan report sengaja tetap berada di tiap file domain agar page tidak menjadi service hub.
import DashboardCu from '../features/cu/dashboard/dashboard_cu.vue'
import DashboardSlot2 from '../features/placeholders/dashboard/dashboard_slot2.vue'
import DashboardSlot3 from '../features/placeholders/dashboard/dashboard_slot3.vue'
import DashboardSlot4 from '../features/placeholders/dashboard/dashboard_slot4.vue'
import DashboardSlot5 from '../features/placeholders/dashboard/dashboard_slot5.vue'
import DashboardSlot6 from '../features/placeholders/dashboard/dashboard_slot6.vue'
</script>

<template>
  <section class="dashboard-page" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title" class="dashboard-heading">Dashboard</h1>

    <!-- Dashboard baru ditambahkan sebagai satu komponen domain; grid tidak mengetahui data/route-nya. -->
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

/* minmax(0, 1fr) mencegah canvas memaksa overflow; row 1fr menyamakan tinggi satu baris. */
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
  /* Dua kolom menjaga diameter doughnut dan ringkasan tetap terbaca pada desktop sempit/tablet. */
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  /* Satu kolom mengembalikan tinggi alami agar kartu tidak menyisakan ruang kosong di mobile. */
  .dashboard-grid {
    grid-auto-rows: auto;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
}
</style>
