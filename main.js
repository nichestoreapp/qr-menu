/* ============================================================
   ACE CAFÉ — Main Application Logic
   ============================================================ */

(function () {
  'use strict';

  /* ---------- State ---------- */
  let menuData = null;
  let activeCategory = 'all';
  let searchQuery = '';
  let currentLang = 'tr'; // Default language

  const staticTranslations = {
    all: { tr: "Tümü", en: "All" },
    searchPlaceholder: { tr: "Menüde ara...", en: "Search menu..." },
    emptySearchHtml: { 
      tr: (q) => `Aradığınız "<strong>${escapeHtml(q)}</strong>" ile eşleşen ürün bulunamadı.`,
      en: (q) => `No items found matching<br>"<strong>${escapeHtml(q)}</strong>"`
    },
    errorHtml: {
      tr: `Menü yüklenemedi.<br>Lütfen sayfayı yenilemeyi deneyin.`,
      en: `Could not load the menu.<br>Please try refreshing the page.`
    },
    tags: {
      popular: { tr: "Popüler", en: "Popular" },
      healthy: { tr: "Sağlıklı", en: "Healthy" },
      vegan: { tr: "Vegan", en: "Vegan" },
      vegetarian: { tr: "Vejetaryen", en: "Vegetarian" }
    }
  };

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

  /** Get localized string from object or string */
  function getLocStr(objOrString) {
    if (!objOrString) return '';
    if (typeof objOrString === 'string') return objOrString;
    return objOrString[currentLang] || objOrString['en'] || '';
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
      <span class="tab-icon">✦</span> ${staticTranslations.all[currentLang]}
    </button>`;

    categories.forEach((cat) => {
      html += `<button class="category-tab" data-category="${cat.id}">
        <span class="tab-icon">${cat.icon}</span> ${getLocStr(cat.name)}
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
      .map((tag) => {
        const tagLoc = staticTranslations.tags[tag]?.[currentLang] || tag;
        return `<span class="tag tag-${tag}">${tagLoc}</span>`;
      })
      .join('');

    const imageHtml = item.image
      ? `<img src="${item.image}" alt="${getLocStr(item.name)}" loading="lazy">`
      : `<span class="placeholder-icon">${getCategoryPlaceholder(categoryId)}</span>`;

    return `
      <article class="menu-card" id="item-${item.id}">
        <div class="card-image">${imageHtml}</div>
        <div class="card-body">
          <div class="card-header">
            <h3 class="card-name">${getLocStr(item.name)}</h3>
            <span class="card-price">${formatPrice(item.price, currency)}</span>
          </div>
          <p class="card-description">${getLocStr(item.description)}</p>
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
        
        const itemNameLoc = getLocStr(item.name).toLowerCase();
        const itemDescLoc = getLocStr(item.description).toLowerCase();
        
        return (
          itemNameLoc.includes(query) ||
          itemDescLoc.includes(query) ||
          item.tags.some((t) => {
            const tagLoc = (staticTranslations.tags[t]?.[currentLang] || t).toLowerCase();
            return tagLoc.includes(query);
          })
        );
      });

      if (filteredItems.length === 0) return;

      hasResults = true;

      html += `
        <section class="category-section" id="section-${category.id}">
          <h2 class="category-section-title">
            <span class="section-icon">${category.icon}</span>
            ${getLocStr(category.name)}
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
          <p>${staticTranslations.emptySearchHtml[currentLang](query)}</p>
        </div>`;
    }

    container.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ---------- Interactions ---------- */
  function initSearch() {
    const input = $('#search-input');
    if (!input) return;
    
    input.placeholder = staticTranslations.searchPlaceholder[currentLang];

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = input.value;
        renderMenu();
      }, 200);
    });
  }

  function updateStaticTexts() {
    const h1 = $('h1');
    if (h1 && menuData) {
      h1.textContent = getLocStr(menuData.restaurant.name);
    }
    const tagline = $('.header-text p');
    if (tagline && menuData) {
      tagline.textContent = getLocStr(menuData.restaurant.tagline);
    }
    const input = $('#search-input');
    if (input) {
      input.placeholder = staticTranslations.searchPlaceholder[currentLang];
    }
    document.title = getLocStr(menuData.restaurant.name) + " — Menu";
  }

  function initLangSwitcher() {
    $$('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedLang = btn.dataset.lang;
        if (currentLang === selectedLang) return;
        
        currentLang = selectedLang;
        
        // Update UI buttons
        $$('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        updateStaticTexts();
        renderCategoryTabs(menuData.categories);
        renderMenu();
      });
    });
  }

  /* ---------- Bootstrap ---------- */
  async function init() {
    renderSkeleton();
    initLangSwitcher();

    try {
      // Added a cache buster timestamp parameter for development purposes, but fetching normal in prod
      const response = await fetch('./menu.json?v=' + new Date().getTime());
      if (!response.ok) throw new Error('Failed to load menu data');
      menuData = await response.json();
    } catch (err) {
      console.error('Menu load error:', err);
      const container = $('#menu-container');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <p>${staticTranslations.errorHtml[currentLang]}</p>
          </div>`;
      }
      return;
    }

    // Update header
    updateStaticTexts();

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
