/* ============================================================
   TENIS CAFE — Main Application Logic (Firebase Edition)
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, getDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/* ---------- State ---------- */
let menuData = null;
let activeCategory = 'all';
let searchQuery = '';
let currentLang = 'tr';

const staticTranslations = {
  all: { tr: 'Tümü', en: 'All' },
  searchPlaceholder: { tr: 'Menüde ara...', en: 'Search menu...' },
  emptySearchHtml: {
    tr: (q) => `Aradığınız "<strong>${escapeHtml(q)}</strong>" ile eşleşen ürün bulunamadı.`,
    en: (q) => `No items found matching "<strong>${escapeHtml(q)}</strong>"`
  },
  errorHtml: {
    tr: 'Menü yüklenemedi.<br>Lütfen sayfayı yenilemeyi deneyin.',
    en: 'Could not load the menu.<br>Please try refreshing the page.'
  },
  tags: {
    popular:    { tr: 'Popüler',    en: 'Popular' },
    healthy:    { tr: 'Sağlıklı',   en: 'Healthy' },
    vegan:      { tr: 'Vegan',      en: 'Vegan' },
    vegetarian: { tr: 'Vejetaryen', en: 'Vegetarian' }
  }
};

/* ---------- Helpers ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatPrice(price, currency) {
  return `${price}${currency}`;
}

function getCategoryPlaceholder(categoryId) {
  const map = {
    starters: '🥗', mains: '🍽️', snacks: '🎾',
    drinks: '🥤', desserts: '🍰'
  };
  return map[categoryId] || '🍴';
}

function getLocStr(objOrString) {
  if (!objOrString) return '';
  if (typeof objOrString === 'string') return objOrString;
  return objOrString[currentLang] || objOrString['en'] || '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ---------- Data Loading ---------- */
async function loadMenuFromFirestore() {
  // Load restaurant info
  const infoSnap = await getDoc(doc(db, 'restaurant', 'info'));
  if (!infoSnap.exists()) throw new Error('Restaurant info not found');
  const restaurant = infoSnap.data();

  // Load categories ordered by 'order' field
  const catQuery = query(collection(db, 'categories'), orderBy('order'));
  const catSnap = await getDocs(catQuery);
  const categories = [];
  catSnap.forEach((d) => {
    categories.push({ id: d.id, ...d.data() });
  });

  return { restaurant, categories };
}

/* Fallback: try loading from menu.json if Firebase is not configured */
async function loadMenuFromJSON() {
  const response = await fetch('./menu.json');
  if (!response.ok) throw new Error('Failed to load menu.json');
  return await response.json();
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

  $$('.category-tab', nav).forEach((tab) => {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.category;
      $$('.category-tab', nav).forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderMenu();
      tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  });
}

function renderMenuCard(item, categoryId, currency) {
  const tagsHtml = (item.tags || [])
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
  const q = searchQuery.toLowerCase().trim();
  let html = '';
  let hasResults = false;

  menuData.categories.forEach((category) => {
    if (activeCategory !== 'all' && category.id !== activeCategory) return;

    const filteredItems = (category.items || []).filter((item) => {
      if (!q) return true;
      const nameLoc = getLocStr(item.name).toLowerCase();
      const descLoc = getLocStr(item.description).toLowerCase();
      return (
        nameLoc.includes(q) || descLoc.includes(q) ||
        (item.tags || []).some((t) => {
          const tagLoc = (staticTranslations.tags[t]?.[currentLang] || t).toLowerCase();
          return tagLoc.includes(q);
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
        <p>${staticTranslations.emptySearchHtml[currentLang](q)}</p>
      </div>`;
  }

  container.innerHTML = html;
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
  if (h1 && menuData) h1.textContent = getLocStr(menuData.restaurant.name);
  const tagline = $('.header-text p');
  if (tagline && menuData) tagline.textContent = getLocStr(menuData.restaurant.tagline);
  const input = $('#search-input');
  if (input) input.placeholder = staticTranslations.searchPlaceholder[currentLang];
  if (menuData) document.title = getLocStr(menuData.restaurant.name) + ' — Menu';
}

function initLangSwitcher() {
  $$('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (currentLang === lang) return;
      currentLang = lang;
      $$('.lang-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
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
    // Try Firebase first, fallback to local JSON
    menuData = await loadMenuFromFirestore();
  } catch (firebaseErr) {
    console.warn('Firebase load failed, trying local JSON fallback:', firebaseErr.message);
    try {
      menuData = await loadMenuFromJSON();
    } catch (jsonErr) {
      console.error('All data sources failed:', jsonErr);
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
  }

  updateStaticTexts();
  renderCategoryTabs(menuData.categories);
  renderMenu();
  initSearch();
}

init();
