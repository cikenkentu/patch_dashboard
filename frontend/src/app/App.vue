<script setup>
// Root shell hanya memiliki chrome global, landmark, dan outlet route.
// Fetch, filter, serta state bisnis tetap berada di view agar App tidak menjadi dependency lintas-domain.
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <!-- Skip-link membentuk kontrak landmark global; targetnya harus tetap tersedia di setiap route. -->
    <a class="skip-link" href="#main-content">Lewati ke konten utama</a>

    <!-- Brand adalah navigasi produk; navigasi kontekstual seperti "kembali" dimiliki layout report. -->
    <header class="app-header">
      <div class="app-header__inner page-container">
        <RouterLink class="brand" to="/">Patching</RouterLink>
      </div>
    </header>

    <!-- RouterView mengisolasi lifecycle halaman; id ini adalah target stabil untuk skip-link di atas. -->
    <main id="main-content" class="page-container main-content">
      <RouterView />
    </main>
  </div>
</template>

<style>
/*
 * Style shell sengaja global agar token/reset dapat dipakai view dan override PrimeVue.
 * Variabel di :root adalah kontrak visual bersama; detail domain tetap scoped di view pemiliknya.
 */
:root {
  color: #344054;
  background: #f5f6f7;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --header-height: 56px;
  --surface: #ffffff;
  --border: #d0d5dd;
  --border-light: #e4e7ec;
  --text: #17202a;
  --muted: #667085;
  --link: #175cd3;
}

* {
  /* Ukuran komponen tetap dapat diprediksi ketika padding atau border ditambahkan. */
  box-sizing: border-box;
}

/* Shell boleh menyusut mengikuti layout viewport; komponen menangani wrap/scroll secara lokal. */
html,
body,
#app {
  min-width: 0;
  min-height: 100%;
}

body {
  margin: 0;
  background: #f5f6f7;
}

button,
input,
select,
textarea {
  font: inherit;
}

a {
  color: inherit;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  color: var(--text);
  font-size: clamp(1.75rem, 3vw, 2.1rem);
  line-height: 1.2;
  letter-spacing: -0.025em;
}

h2 {
  margin: 0;
  color: var(--text);
  font-size: 1.05rem;
  line-height: 1.4;
}

/* Skip link tersembunyi sampai menerima fokus keyboard. */
.skip-link {
  position: fixed;
  z-index: 1000;
  top: 0.75rem;
  left: 0.75rem;
  padding: 0.6rem 0.85rem;
  color: #ffffff;
  background: var(--link);
  transform: translateY(-150%);
}

.skip-link:focus {
  transform: translateY(0);
}

.app-shell {
  /* Fallback vh mendukung browser lama; dvh mengikuti tinggi viewport mobile yang dinamis. */
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.page-container {
  /* Satu aturan lebar menjaga header, dashboard, dan report sejajar. */
  width: calc(100% - 48px);
  margin: 0 auto;
}

.app-header {
  /* Satu token tinggi dipakai header dan kalkulasi viewport; jangan hard-code nilai kedua. */
  height: var(--header-height);
  flex: 0 0 var(--header-height);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.app-header__inner {
  display: flex;
  height: 100%;
  min-height: 0;
  align-items: center;
}

.brand {
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
}

.main-content {
  /* Flex memberi report tinggi tersisa untuk area tabel tanpa card berukuran tetap. */
  display: flex;
  /* vh adalah fallback; dvh mengikuti area browser mobile yang benar-benar terlihat. */
  min-height: calc(100vh - var(--header-height));
  min-height: calc(100dvh - var(--header-height));
  flex: 1;
  flex-direction: column;
  padding-top: 2rem;
  padding-bottom: 2rem;
}

@media (max-width: 760px) {
  /* Jarak halaman diperkecil pada tablet dan ponsel. */
  .page-container {
    width: calc(100% - 28px);
  }

  .main-content {
    padding-top: 1.5rem;
    padding-bottom: 2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* Hormati preferensi pengguna yang mengurangi animasi. */
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
