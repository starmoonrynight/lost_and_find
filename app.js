/* =========================================================
   失物招领 · 前端逻辑
   数据保存于 localStorage，无需后端
   ========================================================= */

const STORAGE_KEY = 'lost-found-items-v1';
const THEME_KEY = 'lost-found-theme';

const CATEGORIES = [
  '证件卡类', '电子产品', '钥匙', '钱包/包', '书籍资料', '衣物配饰', '其他'
];

const state = {
  items: [],
  type: 'all',        // all | lost | found
  category: 'all',
  status: 'open',     // all | open | closed
  sort: 'newest',     // newest | oldest | dateDesc
  keyword: '',
  imageData: ''       // 当前表单临时图片
};

/* ---------- DOM 快捷 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- 工具函数 ---------- */
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
  if (!dateStr) return '未知';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- 图片压缩 ---------- */
function compressImage(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- 数据读写 ---------- */
function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(state.items)) state.items = [];
  } catch {
    state.items = [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  } catch (e) {
    console.error(e);
    toast('保存失败，可能是本地存储空间不足');
  }
}

/* ---------- 主题 ---------- */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  updateThemeIcon(theme);
}

function toggleTheme() {
  const now = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = now;
  localStorage.setItem(THEME_KEY, now);
  updateThemeIcon(now);
}

function updateThemeIcon(theme) {
  const btn = $('#themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ---------- 分类下拉 ---------- */
function fillCategories() {
  const catFilter = $('#categoryFilter');
  const catForm = $('#fCategory');
  if (catFilter) {
    catFilter.innerHTML = '<option value="all">全部分类</option>' +
      CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }
  if (catForm) {
    catForm.innerHTML = '<option value="">请选择分类</option>' +
      CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }
}

/* ---------- 渲染统计 ---------- */
function renderStats() {
  const total = state.items.length;
  const lost = state.items.filter(i => i.type === 'lost').length;
  const found = state.items.filter(i => i.type === 'found').length;
  const closed = state.items.filter(i => i.status === 'closed').length;
  const el = $('#stats');
  if (!el) return;
  el.innerHTML = `
    <span class="stat-chip">共 <b>${total}</b> 条</span>
    <span class="stat-chip">寻物 <b>${lost}</b></span>
    <span class="stat-chip">招领 <b>${found}</b></span>
    <span class="stat-chip">已解决 <b>${closed}</b></span>
  `;
}

/* ---------- 过滤与排序 ---------- */
function getFilteredItems() {
  const kw = state.keyword.trim().toLowerCase();
  let list = state.items.filter(item => {
    if (state.type !== 'all' && item.type !== state.type) return false;
    if (state.category !== 'all' && item.category !== state.category) return false;
    if (state.status !== 'all' && item.status !== state.status) return false;
    if (kw) {
      const text = `${item.title} ${item.location} ${item.description} ${item.category}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });

  if (state.sort === 'newest') {
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (state.sort === 'oldest') {
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } else if (state.sort === 'dateDesc') {
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  return list;
}

/* ---------- 渲染卡片网格 ---------- */
function renderGrid(list) {
  const grid = $('#grid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = list.map(item => `
    <article class="card" data-id="${item.id}">
      <div class="card-media">
        ${item.image
          ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy">`
          : `<div class="card-placeholder">${item.type === 'lost' ? '🔍' : '📦'}</div>`}
      </div>
      <div class="card-body">
        <div class="card-top">
          <span class="badge ${item.type}">${item.type === 'lost' ? '寻物启事' : '失物招领'}</span>
          <span class="badge">${escapeHtml(item.category)}</span>
          ${item.status === 'closed' ? '<span class="badge closed">已解决</span>' : ''}
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || '暂无描述')}</p>
        <div class="card-meta">
          <span>📍 ${escapeHtml(item.location)}</span>
          <span>📅 ${formatDate(item.date)}</span>
        </div>
      </div>
    </article>
  `).join('');
}

/* ---------- 空状态 ---------- */
function renderEmpty(list) {
  const empty = $('#empty');
  const grid = $('#grid');
  if (!empty) return;
  if (list.length === 0) {
    empty.hidden = false;
    grid.hidden = true;
    const text = $('#emptyText');
    if (text) {
      if (state.items.length === 0) {
        text.textContent = '还没有任何信息，快来发布第一条吧';
      } else {
        text.textContent = '没有找到符合条件的信息，试试调整筛选条件';
      }
    }
  } else {
    empty.hidden = true;
    grid.hidden = false;
  }
}

/* ---------- 总渲染 ---------- */
function render() {
  const list = getFilteredItems();
  renderStats();
  renderGrid(list);
  renderEmpty(list);
}

/* ---------- 弹窗控制 ---------- */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function closeAllModals() {
  $$('.overlay.show').forEach(el => closeModal(el.id));
}

/* ---------- 表单重置 ---------- */
function resetForm() {
  const form = $('#publishForm');
  if (!form) return;
  form.reset();
  const date = $('#fDate');
  if (date) date.value = todayStr();
  state.imageData = '';
  const preview = $('#uploadPreview');
  const placeholder = $('#uploadPlaceholder');
  const removeBtn = $('#removeImage');
  if (preview) { preview.hidden = true; preview.src = ''; }
  if (placeholder) placeholder.hidden = false;
  if (removeBtn) removeBtn.hidden = true;
  const err = $('#formError');
  if (err) { err.hidden = true; err.textContent = ''; }
}

/* ---------- 表单提交 ---------- */
function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);

  const type = fd.get('type') || 'lost';
  const title = String(fd.get('title') || '').trim();
  const category = String(fd.get('category') || '').trim();
  const date = String(fd.get('date') || '').trim();
  const location = String(fd.get('location') || '').trim();
  const description = String(fd.get('description') || '').trim();
  const contact = String(fd.get('contact') || '').trim();

  const errorEl = $('#formError');
  const showError = (msg) => {
    if (errorEl) { errorEl.textContent = msg; errorEl.hidden = false; }
  };

  if (!title) return showError('请填写物品名称');
  if (!category) return showError('请选择物品分类');
  if (!date) return showError('请选择时间');
  if (!location) return showError('请填写地点');
  if (!contact) return showError('请填写联系方式');
  if (errorEl) errorEl.hidden = true;

  const item = {
    id: uuid(),
    type,
    title,
    category,
    date,
    location,
    description,
    contact,
    status: 'open',
    createdAt: Date.now(),
    image: state.imageData || ''
  };

  state.items.unshift(item);
  saveItems();
  closeModal('publishOverlay');
  resetForm();
  render();
  toast('发布成功');
}

/* ---------- 图片上传 ---------- */
async function handleImageChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('请选择图片文件');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast('图片不能超过 5MB');
    return;
  }
  try {
    const dataUrl = await compressImage(file);
    state.imageData = dataUrl;
    const preview = $('#uploadPreview');
    const placeholder = $('#uploadPlaceholder');
    const removeBtn = $('#removeImage');
    if (preview) { preview.src = dataUrl; preview.hidden = false; }
    if (placeholder) placeholder.hidden = true;
    if (removeBtn) removeBtn.hidden = false;
  } catch (err) {
    console.error(err);
    toast('图片处理失败');
  }
}

function removeImage() {
  state.imageData = '';
  const file = $('#fImage');
  if (file) file.value = '';
  const preview = $('#uploadPreview');
  const placeholder = $('#uploadPlaceholder');
  const removeBtn = $('#removeImage');
  if (preview) { preview.hidden = true; preview.src = ''; }
  if (placeholder) placeholder.hidden = false;
  if (removeBtn) removeBtn.hidden = true;
}

/* ---------- 详情 ---------- */
function openDetail(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  const body = $('#detailBody');
  if (!body) return;

  const typeText = item.type === 'lost' ? '寻物启事' : '失物招领';
  const statusText = item.status === 'closed' ? '已解决' : '进行中';

  body.innerHTML = `
    <div class="detail">
      ${item.image ? `<img class="detail-img" src="${item.image}" alt="${escapeHtml(item.title)}">` : ''}
      <div class="detail-badges">
        <span class="badge ${item.type}">${typeText}</span>
        <span class="badge">${escapeHtml(item.category)}</span>
        <span class="badge ${item.status === 'closed' ? 'closed' : ''}">${statusText}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || '暂无描述')}</p>
      <dl>
        <div><dt>时间</dt><dd>${formatDate(item.date)}</dd></div>
        <div><dt>地点</dt><dd>${escapeHtml(item.location)}</dd></div>
        <div><dt>联系方式</dt><dd>${escapeHtml(item.contact)}</dd></div>
        <div><dt>发布时间</dt><dd>${new Date(item.createdAt).toLocaleString('zh-CN')}</dd></div>
      </dl>
      <div class="detail-actions">
        <button class="btn btn-primary" data-action="copy" data-id="${item.id}">复制联系方式</button>
        ${item.status === 'open'
          ? `<button class="btn btn-ghost" data-action="resolve" data-id="${item.id}">标记已解决</button>`
          : ''}
        <button class="btn btn-danger" data-action="delete" data-id="${item.id}">删除</button>
      </div>
    </div>
  `;
  openModal('detailOverlay');
}

async function copyContact(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  try {
    await navigator.clipboard.writeText(item.contact);
    toast('联系方式已复制');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = item.contact;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('联系方式已复制');
  }
}

function resolveItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  item.status = 'closed';
  saveItems();
  closeModal('detailOverlay');
  render();
  toast('已标记为已解决');
}

function deleteItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`确定删除“${item.title}”吗？此操作不可恢复。`)) return;
  state.items = state.items.filter(i => i.id !== id);
  saveItems();
  closeModal('detailOverlay');
  render();
  toast('已删除');
}

/* ---------- 示例数据 ---------- */
function seedDemo() {
  const now = Date.now();
  const demo = [
    {
      id: uuid(),
      type: 'lost',
      title: '黑色 iPhone 15',
      category: '电子产品',
      date: todayStr(),
      location: '图书馆三楼自习区',
      description: '黑色硅胶壳，锁屏是一只橘猫，有重要资料，捡到必有重谢。',
      contact: '微信：find_phone',
      status: 'open',
      createdAt: now - 3600_000,
      image: ''
    },
    {
      id: uuid(),
      type: 'found',
      title: '校园卡（张同学）',
      category: '证件卡类',
      date: todayStr(),
      location: '第二食堂门口',
      description: '卡面姓名张*，学号尾号 3721，请失主联系认领。',
      contact: 'QQ：12345678',
      status: 'open',
      createdAt: now - 7200_000,
      image: ''
    },
    {
      id: uuid(),
      type: 'lost',
      title: '一串钥匙（带小熊挂件）',
      category: '钥匙',
      date: todayStr(),
      location: '体育馆篮球场',
      description: '三把钥匙，挂件是棕色小熊，可能掉在观众席附近。',
      contact: '手机：138****0000',
      status: 'closed',
      createdAt: now - 86400_000,
      image: ''
    }
  ];
  state.items = [...demo, ...state.items];
  saveItems();
  render();
  toast('已载入示例数据');
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  // 发布
  $('#btnPublish')?.addEventListener('click', () => {
    resetForm();
    openModal('publishOverlay');
  });
  $('#btnPublishEmpty')?.addEventListener('click', () => {
    resetForm();
    openModal('publishOverlay');
  });

  // 关闭弹窗
  $$('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.overlay');
      if (overlay) closeModal(overlay.id);
    });
  });
  $$('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // 主题
  $('#themeToggle')?.addEventListener('click', toggleTheme);

  // 搜索
  $('#searchInput')?.addEventListener('input', (e) => {
    state.keyword = e.target.value;
    render();
  });

  // 类型标签
  $('#typeTabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    state.type = btn.dataset.type;
    $$('#typeTabs button').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });

  // 筛选
  $('#categoryFilter')?.addEventListener('change', (e) => {
    state.category = e.target.value;
    render();
  });
  $('#statusFilter')?.addEventListener('change', (e) => {
    state.status = e.target.value;
    render();
  });
  $('#sortFilter')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  // 表单提交
  $('#publishForm')?.addEventListener('submit', handleSubmit);

  // 图片
  const uploadBox = $('#uploadBox');
  const fileInput = $('#fImage');
  uploadBox?.addEventListener('click', () => fileInput?.click());
  uploadBox?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput?.click();
    }
  });
  fileInput?.addEventListener('change', handleImageChange);
  $('#removeImage')?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeImage();
  });

  // 卡片点击 → 详情
  $('#grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    openDetail(card.dataset.id);
  });

  // 详情操作
  $('#detailBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'copy') copyContact(id);
    if (action === 'resolve') resolveItem(id);
    if (action === 'delete') deleteItem(id);
  });

  // 示例数据
  $('#btnSeed')?.addEventListener('click', seedDemo);
}

/* ---------- 初始化 ---------- */
function init() {
  loadItems();
  initTheme();
  fillCategories();
  const dateInput = $('#fDate');
  if (dateInput) dateInput.value = todayStr();
  bindEvents();
  render();
}

document.addEventListener('DOMContentLoaded', init);
