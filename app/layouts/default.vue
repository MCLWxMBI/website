<template>
  <div class="site-shell">
    <header class="site-header">
      <div class="container header-inner">
        <NuxtLink to="/" class="brand" aria-label="ECHO home">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32"><path d="M7 25c8.5 1 16-4.7 18-18-8.4.2-17.5 4.5-18 18Z"/><path d="M8 24c4-6.5 8.7-10.4 14-13"/></svg>
          </span>
          <span>
            <strong>ECHO</strong>
            <small>Environmental consultations</small>
          </span>
        </NuxtLink>
        <nav aria-label="Primary navigation">
          <NuxtLink to="/" class="nav-link">Opportunities</NuxtLink>
        </nav>
      </div>
    </header>

    <main><slot /></main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <span class="brand-mark brand-mark-small" aria-hidden="true">
            <svg viewBox="0 0 32 32"><path d="M7 25c8.5 1 16-4.7 18-18-8.4.2-17.5 4.5-18 18Z"/><path d="M8 24c4-6.5 8.7-10.4 14-13"/></svg>
          </span>
          <div><strong>ECHO</strong><p>Making environmental policy opportunities easier to find.</p></div>
        </div>
        <p class="prototype-note">Prototype for Victoria and the Commonwealth</p>
      </div>
    </footer>
  </div>
</template>
