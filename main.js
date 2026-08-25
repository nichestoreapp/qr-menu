/* ============================================================
   ACE CAFÉ — Main Application Logic
   ============================================================ */

(function () {
  'use strict';

  /* ---------- State ---------- */
  let menuData = null;
  let activeCategory = 'all';
  let searchQuery = '';

  /* ---------- DOM References ---------- */
  const app = document.getElementById('app');

  /* ---------- Helpers ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /** Format price with currency */
  function formatPrice(price, currency) {
    return `${price}${currency}`;
  }

  /** Get a placeholder icon for a category */
  function getCategoryPlaceholder(categoryId) {
    const map = {
      starters: '🥗',
      mains: '🍽️',
      snacks: '🎾',
      drinks: '🥤',
      desserts: '🍰',
    };
    return map[categoryId] || '🍴';
  }

  /* ---------- Render Functions ---------- */

  function renderSkeleton() {
    const container = $('#menu-container');
    if (!container) return;
    let html = '';
    for (let i = 0; i < 4; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton-image"></div>
          <div class="skeleton-lines">
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>`;
    }
    container.innerHTML = html;
  }

  function renderCategoryTabs(categories) {
    const nav = $('#category-nav');
    if (!nav) return;

    let html = `<button class="category-tab active" data-category="all">
      <span class="tab-icon">✦</span> All
    </button>`;

    categories.forEach((cat) => {
      html += `<button class="category-tab" data-category="${cat.id}">
        <span class="tab-icon">${cat.icon}</span> ${cat.name}
      </button>`;
    });

    nav.innerHTML = html;

    // Attach events
    $$('.category-tab', nav).forEach((tab) => {
      tab.addEventListener('click', () => {
        activeCategory = tab.dataset.category;
        $$('.category-tab', nav).forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderMenu();
        // Scroll tab into view
        tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });
  }

  function renderMenuCard(item, categoryId, currency) {
    const tagsHtml = item.tags
      .map((tag) => `<span class="tag tag-${tag}">${tag}</span>`)
      .join('');

    const imageHtml = item.image
      ? `<img src="${item.image}" alt="${item.name}" loading="lazy">`
      : `<span class="placeholder-icon">${getCategoryPlaceholder(categoryId)}</span>`;

    return `
      <article class="menu-card" id="item-${item.id}">
        <div class="card-image">${imageHtml}</div>
        <div class="card-body">
          <div class="card-header">
            <h3 class="card-name">${item.name}</h3>
            <span class="card-price">${formatPrice(item.price, currency)}</span>
          </div>
          <p class="card-description">${item.description}</p>
          ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
        </div>
      </article>`;
  }

  function renderMenu() {
    const container = $('#menu-container');
    if (!container || !menuData) return;

    const currency = menuData.restaurant.currency;
    const query = searchQuery.toLowerCase().trim();
    let html = '';
    let hasResults = false;

    menuData.categories.forEach((category) => {
      // Category filter
      if (activeCategory !== 'all' && category.id !== activeCategory) return;

      // Filter items by search
      const filteredItems = category.items.filter((item) => {
        if (!query) return true;
        return (
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags.some((t) => t.toLowerCase().includes(query))
        );
      });

      if (filteredItems.length === 0) return;

      hasResults = true;

      html += `
        <section class="category-section" id="section-${category.id}">
          <h2 class="category-section-title">
            <span class="section-icon">${category.icon}</span>
            ${category.name}
            <span class="section-line"></span>
          </h2>
          <div class="menu-items">
            ${filteredItems.map((item) => renderMenuCard(item, category.id, currency)).join('')}
          </div>
        </section>`;
    });

    if (!hasResults) {
      html = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No items found matching<br>"<strong>${escapeHtml(query)}</strong>"</p>
        </div>`;
    }

    container.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ---------- Search ---------- */
  function initSearch() {
    const input = $('#search-input');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = input.value;
        renderMenu();
      }, 200);
    });
  }

  /* ---------- Bootstrap ---------- */
  async function init() {
    renderSkeleton();

    try {
      const response = await fetch('./menu.json');
      if (!response.ok) throw new Error('Failed to load menu data');
      menuData = await response.json();
    } catch (err) {
      console.error('Menu load error:', err);
      const container = $('#menu-container');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <p>Could not load the menu.<br>Please try refreshing the page.</p>
          </div>`;
      }
      return;
    }

    // Update header
    const h1 = $('h1');
    const tagline = $('.header-text p');
    if (h1) h1.textContent = menuData.restaurant.name;
    if (tagline) tagline.textContent = menuData.restaurant.tagline;

    // Render
    renderCategoryTabs(menuData.categories);
    renderMenu();
    initSearch();
  }

  // Kick off
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
