/* ============================================================
   TENIS CAFE — Admin Panel Logic
   ============================================================ */

import { db, auth } from '../firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

/* ---------- State ---------- */
let categories = [];
let restaurantInfo = null;
let activeCategoryId = null;

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function showToast(msg, type = 'success') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ---------- Auth ---------- */
onAuthStateChanged(auth, (user) => {
  if (user) {
    $('#login-view').hidden = true;
    $('#admin-view').hidden = false;
    loadData();
  } else {
    $('#login-view').hidden = false;
    $('#admin-view').hidden = true;
  }
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameInput = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const errorEl = $('#login-error');
  const btn = $('#login-btn');

  // Firebase arka planda e-posta istediği için, kullanıcı adının sonuna gizlice domain ekliyoruz.
  const email = usernameInput.includes('@') ? usernameInput : `${usernameInput}@teniscafe.com`;

  errorEl.hidden = true;
  btn.textContent = 'Giriş yapılıyor...';
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    const messages = {
      'auth/user-not-found': 'Bu e-posta ile kayıtlı bir hesap bulunamadı.',
      'auth/wrong-password': 'Şifre hatalı. Lütfen tekrar deneyin.',
      'auth/invalid-email': 'Geçersiz e-posta adresi.',
      'auth/invalid-credential': 'E-posta veya şifre hatalı.',
      'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen biraz bekleyin.'
    };
    errorEl.textContent = messages[err.code] || 'Giriş başarısız: ' + err.message;
    errorEl.hidden = false;
  } finally {
    btn.textContent = 'Giriş Yap';
    btn.disabled = false;
  }
});

$('#logout-btn').addEventListener('click', () => signOut(auth));

/* ---------- Data Loading ---------- */
async function loadData() {
  try {
    // Load restaurant info
    const infoSnap = await getDoc(doc(db, 'restaurant', 'info'));
    if (infoSnap.exists()) {
      restaurantInfo = infoSnap.data();
    }

    // Load categories
    const catQuery = query(collection(db, 'categories'), orderBy('order'));
    const catSnap = await getDocs(catQuery);
    categories = [];
    catSnap.forEach((d) => {
      categories.push({ id: d.id, ...d.data() });
    });

    // Show migration banner if empty
    if (categories.length === 0) {
      $('#migration-banner').hidden = false;
    } else {
      $('#migration-banner').hidden = true;
    }

    renderCategoryTabs();

    // Select first category if available
    if (categories.length > 0 && !activeCategoryId) {
      activeCategoryId = categories[0].id;
      renderCategoryTabs();
      renderItems();
    }
  } catch (err) {
    console.error('Veri yükleme hatası:', err);
    showToast('Veri yüklenirken hata oluştu: ' + err.message, 'error');
  }
}

/* ---------- Migration ---------- */
$('#migrate-btn').addEventListener('click', async () => {
  const btn = $('#migrate-btn');
  btn.textContent = 'Aktarılıyor...';
  btn.disabled = true;

  try {
    const res = await fetch('../menu.json');
    if (!res.ok) throw new Error('menu.json bulunamadı');
    const data = await res.json();

    // Write restaurant info
    const nameData = typeof data.restaurant.name === 'string'
      ? { tr: data.restaurant.name, en: data.restaurant.name }
      : data.restaurant.name;
    const taglineData = typeof data.restaurant.tagline === 'string'
      ? { tr: data.restaurant.tagline, en: data.restaurant.tagline }
      : data.restaurant.tagline;

    await setDoc(doc(db, 'restaurant', 'info'), {
      name: nameData,
      tagline: taglineData,
      currency: data.restaurant.currency || '₺'
    });

    // Write categories
    for (let i = 0; i < data.categories.length; i++) {
      const cat = data.categories[i];
      const catId = cat.id;

      const nameObj = typeof cat.name === 'string'
        ? { tr: cat.name, en: cat.name }
        : cat.name;

      const items = (cat.items || []).map((item) => ({
        id: item.id,
        name: typeof item.name === 'string'
          ? { tr: item.name, en: item.name }
          : item.name,
        description: typeof item.description === 'string'
          ? { tr: item.description, en: item.description }
          : item.description,
        price: item.price,
        tags: item.tags || [],
        image: item.image || ''
      }));

      await setDoc(doc(db, 'categories', catId), {
        name: nameObj,
        icon: cat.icon || '🍴',
        order: i,
        items: items
      });
    }

    showToast('Veriler başarıyla aktarıldı!');
    await loadData();
  } catch (err) {
    console.error('Aktarma hatası:', err);
    showToast('Aktarma hatası: ' + err.message, 'error');
  } finally {
    btn.textContent = 'Verileri Aktar';
    btn.disabled = false;
  }
});

/* ---------- Category Tabs Rendering ---------- */
function renderCategoryTabs() {
  const tabsContainer = $('#admin-tabs');
  let html = '';

  categories.forEach((cat) => {
    const active = cat.id === activeCategoryId ? 'active' : '';
    html += `<button class="admin-tab ${active}" data-cat-id="${cat.id}">
      ${cat.icon} ${cat.name.tr || cat.name.en || cat.id}
    </button>`;
  });

  html += `<button class="admin-tab" data-action="add-category">+ Yeni Kategori</button>`;
  tabsContainer.innerHTML = html;

  // Attach events
  $$('.admin-tab[data-cat-id]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeCategoryId = tab.dataset.catId;
      renderCategoryTabs();
      renderItems();
    });
  });

  $$('.admin-tab[data-action="add-category"]').forEach((tab) => {
    tab.addEventListener('click', openCategoryModal);
  });
}

/* ---------- Items Rendering ---------- */
function renderItems() {
  const category = categories.find((c) => c.id === activeCategoryId);
  if (!category) return;

  const titleEl = $('#content-title');
  titleEl.textContent = `${category.icon} ${category.name.tr || category.name.en}`;

  $('#add-item-btn').hidden = false;
  $('#delete-category-btn').hidden = false;

  const listEl = $('#items-list');
  const items = category.items || [];

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍽️</div>
        <p>Bu kategoride henüz ürün yok. "Yeni Ürün Ekle" butonuyla ilk ürününüzü ekleyin.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = items.map((item, index) => {
    const tagsHtml = (item.tags || []).map(t =>
      `<span class="item-tag item-tag-${t}">${t}</span>`
    ).join('');

    return `
      <div class="item-row" data-index="${index}">
        <div class="item-icon">${category.icon}</div>
        <div class="item-info">
          <div class="item-name">${item.name.tr || item.name.en || '—'}</div>
          <div class="item-desc">${item.description?.tr || item.description?.en || ''}</div>
        </div>
        ${tagsHtml ? `<div class="item-tags">${tagsHtml}</div>` : ''}
        <div class="item-price">${item.price}₺</div>
        <div class="item-actions">
          <button class="btn-icon" data-action="edit" data-index="${index}" title="Düzenle">✏️</button>
          <button class="btn-icon danger" data-action="delete" data-index="${index}" title="Sil">🗑️</button>
        </div>
      </div>`;
  }).join('');

  // Item action events
  $$('.btn-icon[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => openItemModal(parseInt(btn.dataset.index)));
  });

  $$('.btn-icon[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteItem(parseInt(btn.dataset.index)));
  });
}

/* ---------- Item CRUD ---------- */
function openItemModal(editIndex = -1) {
  const modal = $('#item-modal');
  const form = $('#item-form');
  const title = $('#modal-title');

  form.reset();
  $('#item-edit-index').value = editIndex;

  if (editIndex >= 0) {
    const category = categories.find((c) => c.id === activeCategoryId);
    const item = category.items[editIndex];
    title.textContent = 'Ürün Düzenle';
    $('#item-name-tr').value = item.name?.tr || '';
    $('#item-name-en').value = item.name?.en || '';
    $('#item-desc-tr').value = item.description?.tr || '';
    $('#item-desc-en').value = item.description?.en || '';
    $('#item-price').value = item.price || '';
    $('#item-image').value = item.image || '';
    $$('input[name="tags"]').forEach((cb) => {
      cb.checked = (item.tags || []).includes(cb.value);
    });
  } else {
    title.textContent = 'Yeni Ürün Ekle';
  }

  modal.hidden = false;
}

$('#add-item-btn').addEventListener('click', () => openItemModal(-1));

$('#item-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const editIndex = parseInt($('#item-edit-index').value);
  const category = categories.find((c) => c.id === activeCategoryId);
  if (!category) return;

  const tags = $$('input[name="tags"]:checked').map((cb) => cb.value);

  const itemData = {
    id: editIndex >= 0 ? category.items[editIndex].id : Date.now(),
    name: {
      tr: $('#item-name-tr').value.trim(),
      en: $('#item-name-en').value.trim() || $('#item-name-tr').value.trim()
    },
    description: {
      tr: $('#item-desc-tr').value.trim(),
      en: $('#item-desc-en').value.trim()
    },
    price: parseInt($('#item-price').value) || 0,
    tags: tags,
    image: $('#item-image').value.trim()
  };

  if (editIndex >= 0) {
    category.items[editIndex] = itemData;
  } else {
    category.items = category.items || [];
    category.items.push(itemData);
  }

  try {
    await setDoc(doc(db, 'categories', activeCategoryId), {
      name: category.name,
      icon: category.icon,
      order: category.order,
      items: category.items
    });

    showToast(editIndex >= 0 ? 'Ürün güncellendi!' : 'Yeni ürün eklendi!');
    closeItemModal();
    renderItems();
  } catch (err) {
    showToast('Kaydetme hatası: ' + err.message, 'error');
  }
});

function closeItemModal() {
  $('#item-modal').hidden = true;
}

$('#modal-close').addEventListener('click', closeItemModal);
$('#modal-cancel').addEventListener('click', closeItemModal);

async function deleteItem(index) {
  const category = categories.find((c) => c.id === activeCategoryId);
  if (!category) return;
  const item = category.items[index];

  if (!confirm(`"${item.name.tr || item.name.en}" ürününü silmek istediğinize emin misiniz?`)) return;

  category.items.splice(index, 1);

  try {
    await setDoc(doc(db, 'categories', activeCategoryId), {
      name: category.name,
      icon: category.icon,
      order: category.order,
      items: category.items
    });
    showToast('Ürün silindi.');
    renderItems();
  } catch (err) {
    showToast('Silme hatası: ' + err.message, 'error');
  }
}

/* ---------- Category CRUD ---------- */
function openCategoryModal() {
  const modal = $('#category-modal');
  $('#category-form').reset();
  $('#cat-modal-title').textContent = 'Yeni Kategori';
  modal.hidden = false;
}

$('#category-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const catId = $('#cat-id').value.trim().toLowerCase().replace(/\s+/g, '-') || 'cat-' + Date.now();
  const catData = {
    name: {
      tr: $('#cat-name-tr').value.trim(),
      en: $('#cat-name-en').value.trim() || $('#cat-name-tr').value.trim()
    },
    icon: $('#cat-icon').value.trim() || '🍴',
    order: categories.length,
    items: []
  };

  try {
    await setDoc(doc(db, 'categories', catId), catData);
    showToast('Yeni kategori oluşturuldu!');
    closeCategoryModal();
    activeCategoryId = catId;
    await loadData();
    renderItems();
  } catch (err) {
    showToast('Kategori oluşturma hatası: ' + err.message, 'error');
  }
});

function closeCategoryModal() {
  $('#category-modal').hidden = true;
}

$('#cat-modal-close').addEventListener('click', closeCategoryModal);
$('#cat-modal-cancel').addEventListener('click', closeCategoryModal);

$('#delete-category-btn').addEventListener('click', async () => {
  const category = categories.find((c) => c.id === activeCategoryId);
  if (!category) return;

  const name = category.name.tr || category.name.en;
  if (!confirm(`"${name}" kategorisini ve içindeki tüm ürünleri silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) return;

  try {
    await deleteDoc(doc(db, 'categories', activeCategoryId));
    showToast(`"${name}" kategorisi silindi.`);
    activeCategoryId = null;
    await loadData();
    // Reset content area
    $('#content-title').textContent = 'Kategori Seçin';
    $('#add-item-btn').hidden = true;
    $('#delete-category-btn').hidden = true;
    $('#items-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Sol taraftan bir kategori seçin veya yeni bir kategori oluşturun.</p>
      </div>`;
  } catch (err) {
    showToast('Silme hatası: ' + err.message, 'error');
  }
});

/* ---------- Modal Overlay Click to Close ---------- */
$('#item-modal').addEventListener('click', (e) => {
  if (e.target === $('#item-modal')) closeItemModal();
});

$('#category-modal').addEventListener('click', (e) => {
  if (e.target === $('#category-modal')) closeCategoryModal();
});

/* ---------- Emoji Picker ---------- */
const emojiDisplay = $('#cat-icon-display');
const emojiPicker = $('#emoji-picker');
const emojiInput = $('#cat-icon');

emojiDisplay.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle('open');
});

emojiPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.emoji-btn');
  if (!btn) return;
  const emoji = btn.textContent.trim();
  emojiInput.value = emoji;
  emojiDisplay.textContent = emoji;
  emojiPicker.classList.remove('open');
});

// Panelin dışına tıklayınca kapat
document.addEventListener('click', (e) => {
  if (!e.target.closest('.emoji-picker-wrapper')) {
    emojiPicker.classList.remove('open');
  }
});
