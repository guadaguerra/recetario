// ---------- Supabase ----------
const sb = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

const DEFAULT_CATEGORIES = ['Dulce', 'Salado', 'Bebidas', 'Postres', 'Panadería'];
const isAdminMode = new URLSearchParams(location.search).has('admin');
document.body.classList.toggle('admin-mode', isAdminMode);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let recipes = [];
let editingId = null;
let viewingId = null;
let isLoggedIn = false;

// ---------- Icons ----------
const ICONS = {
  prep: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0 1 16 0"/><line x1="2" y1="13" x2="22" y2="13"/><line x1="6" y1="17" x2="18" y2="17"/></svg>`,
  cook: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`,
  servings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v8M5 3v4a3 3 0 0 0 6 0V3"/><path d="M8 11v10"/><path d="M17 3c-1.5 0-3 2-3 5s1.5 5 3 5v8"/></svg>`,
  fridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="1.5"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="8" y1="6" x2="8" y2="8"/><line x1="8" y1="13" x2="8" y2="17"/></svg>`,
  freezer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>`,
};

function describeLink(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('youtube') || host.includes('youtu.be')) return { label: 'Mirá el video', btn: 'Ver en YouTube' };
    if (host.includes('tiktok')) return { label: 'Mirá el video', btn: 'Ver en TikTok' };
    if (host.includes('instagram')) return { label: 'Mirá la receta', btn: 'Ver en Instagram' };
    if (host.includes('vimeo')) return { label: 'Mirá el video', btn: 'Ver en Vimeo' };
    return { label: 'Receta original', btn: `Abrir en ${host}` };
  } catch {
    return { label: 'Receta original', btn: 'Abrir link' };
  }
}

// ---------- DB <-> client mapping ----------
function rowToRecipe(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description || '',
    image: row.image || '',
    prepTime: row.prep_time || '',
    cookTime: row.cook_time || '',
    servings: row.servings || '',
    ingredients: row.ingredients || [],
    steps: row.steps || [],
    notes: row.notes || '',
    fridgeStorage: row.fridge_storage || '',
    freezerStorage: row.freezer_storage || '',
    videoUrl: row.video_url || '',
  };
}

function recipeToRow(r) {
  return {
    title: r.title,
    category: r.category,
    description: r.description || null,
    image: r.image || null,
    prep_time: r.prepTime || null,
    cook_time: r.cookTime || null,
    servings: r.servings || null,
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    notes: r.notes || null,
    fridge_storage: r.fridgeStorage || null,
    freezer_storage: r.freezerStorage || null,
    video_url: r.videoUrl || null,
  };
}

// ---------- Data layer ----------
async function loadRecipes() {
  const { data, error } = await sb
    .from('recipes')
    .select('*')
    .order('title', { ascending: true });

  if (error) {
    console.error('Error cargando recetas:', error);
    alert('No se pudieron cargar las recetas. Revisá la consola.');
    return;
  }
  recipes = (data || []).map(rowToRecipe);
}

async function insertRecipe(row) {
  const { data, error } = await sb
    .from('recipes')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToRecipe(data);
}

async function updateRecipe(id, row) {
  const { data, error } = await sb
    .from('recipes')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToRecipe(data);
}

async function deleteRecipeRow(id) {
  const { error } = await sb.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Auth ----------
async function checkAuth() {
  const { data } = await sb.auth.getSession();
  isLoggedIn = !!data.session;
  document.body.classList.toggle('is-logged-in', isLoggedIn);
  updateMigrationBanner();
}

sb.auth.onAuthStateChange((_event, session) => {
  isLoggedIn = !!session;
  document.body.classList.toggle('is-logged-in', isLoggedIn);
  updateMigrationBanner();
});

// ---------- Migración desde localStorage ----------
const LEGACY_STORAGE_KEY = 'recetario.recipes.v1';

function getLegacyRecipes() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function updateMigrationBanner() {
  const banner = $('#migrateBanner');
  if (!banner) return;
  const legacy = getLegacyRecipes();
  if (isLoggedIn && legacy.length > 0) {
    $('#migrateBannerText').textContent =
      `Tenés ${legacy.length} receta${legacy.length === 1 ? '' : 's'} guardada${legacy.length === 1 ? '' : 's'} localmente en este navegador.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

async function importLegacyRecipes() {
  const legacy = getLegacyRecipes();
  if (!legacy.length) return;
  if (!confirm(`¿Importar ${legacy.length} receta${legacy.length === 1 ? '' : 's'} a la nube?`)) return;

  const btn = $('#importLegacyBtn');
  btn.disabled = true;
  btn.textContent = 'Importando…';

  let ok = 0, fail = 0;
  for (const r of legacy) {
    try {
      const row = recipeToRow(r);
      await insertRecipe(row);
      ok++;
    } catch (e) {
      console.error('Error importando:', r.title, e);
      fail++;
    }
  }

  if (ok > 0) {
    localStorage.setItem(LEGACY_STORAGE_KEY + '.backup', localStorage.getItem(LEGACY_STORAGE_KEY));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  await loadRecipes();
  render();
  updateMigrationBanner();

  btn.disabled = false;
  btn.textContent = 'Importar a la nube';

  alert(
    fail === 0
      ? `Listo. Se importaron ${ok} recetas.`
      : `Se importaron ${ok} recetas. Fallaron ${fail} (revisá la consola).`
  );
}

// ---------- Render ----------
function getCategories() {
  const fromRecipes = recipes.map((r) => r.category);
  return [...new Set([...DEFAULT_CATEGORIES, ...fromRecipes])];
}

function render() {
  renderNav();
  renderSections();
  renderCategoryOptions();
}

function renderNav() {
  const nav = $('#categoryNav');
  const used = [...new Set(recipes.map((r) => r.category))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  nav.innerHTML = used
    .map((cat) => `<a href="#cat-${slug(cat)}">${escapeHtml(cat)}</a>`)
    .join('');
}

function renderSections() {
  const container = $('#recipeSections');
  const empty = $('#emptyState');
  const loading = $('#loadingState');

  loading.classList.add('hidden');

  if (recipes.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const grouped = recipes.reduce((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  const sortedCats = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'es'));

  container.innerHTML = sortedCats
    .map((cat) => {
      const cards = grouped[cat]
        .sort((a, b) => a.title.localeCompare(b.title, 'es'))
        .map((r) => recipeCardHtml(r))
        .join('');
      return `
        <section class="category-section" id="cat-${slug(cat)}">
          <header class="category-header">
            <div class="category-rule"><span>Capítulo</span></div>
            <h2 class="category-title">${escapeHtml(cat)}</h2>
          </header>
          <div class="recipes-grid">${cards}</div>
        </section>
      `;
    })
    .join('');

  $$('.recipe-card').forEach((el) => {
    el.addEventListener('click', () => openView(el.dataset.id));
  });
}

function recipeCardHtml(r) {
  const thumb = r.image
    ? `<img class="thumb" src="${r.image}" alt="${escapeHtml(r.title)}" />`
    : `<div class="thumb-placeholder">Sin imagen</div>`;

  const meta = [];
  if (r.prepTime) meta.push(`Prep ${escapeHtml(r.prepTime)}`);
  if (r.cookTime) meta.push(`Cocción ${escapeHtml(r.cookTime)}`);
  if (r.servings) meta.push(`${escapeHtml(r.servings)} porc.`);
  const metaHtml = meta.length
    ? `<div class="meta-mini">${meta.map((m) => `<span>${m}</span>`).join('')}</div>`
    : '';

  return `
    <article class="recipe-card" data-id="${r.id}">
      ${thumb}
      <div class="body">
        <h3>${escapeHtml(r.title)}</h3>
        ${r.description ? `<p class="desc">${escapeHtml(r.description)}</p>` : ''}
        ${metaHtml}
      </div>
    </article>
  `;
}

function renderCategoryOptions() {
  const select = $('#category');
  const cats = getCategories();
  const current = select.value;
  select.innerHTML =
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('') +
    `<option value="__custom__">+ Crear nueva categoría…</option>`;
  if (current && [...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
}

// ---------- Modal: edit / create ----------
function openForm(recipe = null) {
  if (!isLoggedIn) return;

  editingId = recipe ? recipe.id : null;
  $('#modalTitle').textContent = recipe ? 'Editar receta' : 'Nueva receta';
  $('#recipeId').value = recipe?.id || '';
  $('#title').value = recipe?.title || '';
  $('#description').value = recipe?.description || '';
  $('#prepTime').value = recipe?.prepTime || '';
  $('#cookTime').value = recipe?.cookTime || '';
  $('#servings').value = recipe?.servings || '';
  $('#ingredients').value = (recipe?.ingredients || []).join('\n');
  $('#steps').value = (recipe?.steps || []).join('\n');
  $('#notes').value = recipe?.notes || '';
  $('#fridgeStorage').value = recipe?.fridgeStorage || '';
  $('#freezerStorage').value = recipe?.freezerStorage || '';
  $('#videoUrl').value = recipe?.videoUrl || '';
  $('#image').value = '';
  $('#customCategory').value = '';
  $('#customCategoryField').classList.add('hidden');

  renderCategoryOptions();
  if (recipe?.category) $('#category').value = recipe.category;

  const preview = $('#imagePreview');
  if (recipe?.image) {
    preview.src = recipe.image;
    preview.classList.remove('hidden');
    preview.dataset.existing = recipe.image;
  } else {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
    delete preview.dataset.existing;
  }

  $('#recipeModal').classList.remove('hidden');
}

function closeForm() {
  $('#recipeModal').classList.add('hidden');
  $('#recipeForm').reset();
  editingId = null;
}

// ---------- Modal: view ----------
function openView(id) {
  const r = recipes.find((x) => x.id === id);
  if (!r) return;
  viewingId = id;

  const body = $('#viewBody');

  const metaItems = [
    { icon: ICONS.prep, label: 'Preparación', value: r.prepTime || '—' },
    { icon: ICONS.cook, label: 'Cocción', value: r.cookTime || '—' },
    { icon: ICONS.servings, label: 'Porciones', value: r.servings || '—' },
  ];
  const metaRow = `
    <div class="view-meta-row">
      ${metaItems
        .map(
          (m) => `
        <div class="view-meta-item">
          ${m.icon}
          <div class="meta-text">
            <span class="meta-label">${m.label}:</span>
            <span class="meta-value">${escapeHtml(m.value)}</span>
          </div>
        </div>`
        )
        .join('')}
    </div>
  `;

  const imgHtml = r.image
    ? `<img class="view-image" src="${r.image}" alt="${escapeHtml(r.title)}" />`
    : `<div class="view-image-placeholder">Sin imagen</div>`;

  const ingredientsHtml = (r.ingredients || [])
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join('');

  const stepsHtml = (r.steps || [])
    .map((s) => `<p>${escapeHtml(s)}</p>`)
    .join('');

  const notesHtml = r.notes
    ? `<div class="view-notes"><strong>Notas:</strong> ${escapeHtml(r.notes)}</div>`
    : '';

  let storageHtml = '';
  if (r.fridgeStorage || r.freezerStorage) {
    const items = [];
    if (r.fridgeStorage) {
      items.push(`
        <div class="storage-item">
          ${ICONS.fridge}
          <div class="storage-text">
            <span class="storage-label">Heladera</span>
            <span class="storage-value">${escapeHtml(r.fridgeStorage)}</span>
          </div>
        </div>`);
    }
    if (r.freezerStorage) {
      items.push(`
        <div class="storage-item">
          ${ICONS.freezer}
          <div class="storage-text">
            <span class="storage-label">Freezer</span>
            <span class="storage-value">${escapeHtml(r.freezerStorage)}</span>
          </div>
        </div>`);
    }
    storageHtml = `
      <section class="view-storage">
        <h3 class="view-section-title">Conservación</h3>
        <div class="storage-grid">${items.join('')}</div>
      </section>`;
  }

  let videoHtml = '';
  if (r.videoUrl) {
    const info = describeLink(r.videoUrl);
    const isVideo = /youtube|youtu\.be|tiktok|vimeo/i.test(r.videoUrl);
    videoHtml = `
      <div class="view-video">
        <span class="video-label">${escapeHtml(info.label)}</span>
        <a class="video-btn" href="${escapeHtml(r.videoUrl)}" target="_blank" rel="noopener noreferrer">
          ${isVideo ? ICONS.play : ICONS.link}<span>${escapeHtml(info.btn)}</span>
        </a>
      </div>`;
  }

  const descHtml = r.description ? `<p class="view-desc">${escapeHtml(r.description)}</p>` : '';

  body.innerHTML = `
    <div class="view-meta-cat">${escapeHtml(r.category)}</div>
    <h2 class="view-recipe-title">${escapeHtml(r.title)}</h2>
    ${descHtml}
    ${metaRow}
    <div class="view-grid">
      <div>
        <h3 class="view-section-title">Ingredientes</h3>
        <ul class="view-ingredients">${ingredientsHtml}</ul>
      </div>
      <div>
        ${imgHtml}
        <h3 class="view-section-title">Preparación</h3>
        <div class="view-prep">${stepsHtml}</div>
      </div>
    </div>
    ${storageHtml}
    ${notesHtml}
    ${videoHtml}
  `;

  $('#viewModal').classList.remove('hidden');
}

function closeView() {
  $('#viewModal').classList.add('hidden');
  viewingId = null;
}

// ---------- Form submit ----------
async function handleSubmit(e) {
  e.preventDefault();
  if (!isLoggedIn) return;

  const submitBtn = $('#submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando…';

  try {
    const categorySelect = $('#category').value;
    const category =
      categorySelect === '__custom__' ? $('#customCategory').value.trim() : categorySelect;

    if (!category) {
      alert('Por favor ingresá una categoría.');
      return;
    }

    const file = $('#image').files[0];
    let image = $('#imagePreview').dataset.existing || '';
    if (file) {
      try {
        image = await processImage(file);
      } catch (err) {
        alert(err.message);
        return;
      }
    }

    const data = {
      title: $('#title').value.trim(),
      category,
      description: $('#description').value.trim(),
      prepTime: $('#prepTime').value.trim(),
      cookTime: $('#cookTime').value.trim(),
      servings: $('#servings').value.trim(),
      image,
      ingredients: splitLines($('#ingredients').value),
      steps: splitLines($('#steps').value),
      notes: $('#notes').value.trim(),
      fridgeStorage: $('#fridgeStorage').value.trim(),
      freezerStorage: $('#freezerStorage').value.trim(),
      videoUrl: $('#videoUrl').value.trim(),
    };

    const row = recipeToRow(data);

    if (editingId) {
      const updated = await updateRecipe(editingId, row);
      const idx = recipes.findIndex((r) => r.id === editingId);
      if (idx !== -1) recipes[idx] = updated;
    } else {
      const inserted = await insertRecipe(row);
      recipes.push(inserted);
    }

    render();
    closeForm();
  } catch (err) {
    console.error(err);
    alert('Error al guardar: ' + (err?.message || err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar';
  }
}

// ---------- Image processing ----------
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIM = 1920;
const JPEG_QUALITY = 0.85;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = src;
  });
}

async function processImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`La imagen pesa ${mb} MB. El máximo permitido es 5 MB.`);
  }

  const dataUrl = await readFileAsDataURL(file);

  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return dataUrl;
  }

  const img = await loadImage(dataUrl);
  let { width: w, height: h } = img;

  if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
    const ratio = Math.min(MAX_IMAGE_DIM / w, MAX_IMAGE_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function splitLines(s) {
  return s
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function slug(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------- Login ----------
function openLogin() {
  $('#loginError').classList.add('hidden');
  $('#loginForm').reset();
  $('#loginModal').classList.remove('hidden');
}

function closeLogin() {
  $('#loginModal').classList.add('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  const errorEl = $('#loginError');
  errorEl.classList.add('hidden');

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = 'Email o contraseña incorrectos.';
    errorEl.classList.remove('hidden');
    return;
  }
  closeLogin();
}

async function handleLogout() {
  await sb.auth.signOut();
}

// ---------- Búsqueda ----------
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function searchRecipes(query) {
  const nq = normalizeText(query.trim());
  if (!nq) return [];

  return recipes
    .map((r) => {
      const title = normalizeText(r.title);
      const category = normalizeText(r.category);
      const description = normalizeText(r.description);
      const ingredients = (r.ingredients || []).map(normalizeText).join(' ');

      let score = 0;
      if (title.startsWith(nq)) score = 100;
      else if (title.includes(nq)) score = 80;
      else if (category.includes(nq)) score = 50;
      else if (description.includes(nq)) score = 30;
      else if (ingredients.includes(nq)) score = 20;

      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title, 'es'))
    .slice(0, 10)
    .map((x) => x.r);
}

function renderSearchResults(query) {
  const results = $('#searchResults');
  const value = query.trim();

  if (!value) {
    results.classList.add('hidden');
    results.innerHTML = '';
    return;
  }

  const matches = searchRecipes(value);

  if (matches.length === 0) {
    results.innerHTML = '<div class="search-no-results">No se encontraron recetas</div>';
  } else {
    results.innerHTML = matches
      .map((r) => {
        const thumb = r.image
          ? `<img class="search-result-thumb" src="${r.image}" alt="" />`
          : `<div class="search-result-thumb search-result-thumb-empty">Sin foto</div>`;
        return `
          <button class="search-result-item" data-id="${r.id}" type="button">
            ${thumb}
            <div class="search-result-info">
              <div class="search-result-title">${escapeHtml(r.title)}</div>
              <div class="search-result-cat">${escapeHtml(r.category)}</div>
            </div>
          </button>`;
      })
      .join('');

    results.querySelectorAll('.search-result-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        clearSearch();
        openView(id);
      });
    });
  }

  results.classList.remove('hidden');
}

function clearSearch() {
  $('#searchInput').value = '';
  $('#searchClear').classList.add('hidden');
  $('#searchResults').classList.add('hidden');
  $('#searchResults').innerHTML = '';
}

// ---------- Wiring ----------
$('#openFormBtn').addEventListener('click', () => openForm());
$('#loginBtn').addEventListener('click', openLogin);
$('#logoutBtn').addEventListener('click', handleLogout);
$('#importLegacyBtn').addEventListener('click', importLegacyRecipes);

$('#searchInput').addEventListener('input', (e) => {
  const val = e.target.value;
  $('#searchClear').classList.toggle('hidden', !val);
  renderSearchResults(val);
});

$('#searchInput').addEventListener('focus', (e) => {
  if (e.target.value.trim()) renderSearchResults(e.target.value);
});

$('#searchClear').addEventListener('click', () => {
  clearSearch();
  $('#searchInput').focus();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) {
    $('#searchResults').classList.add('hidden');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement === $('#searchInput')) {
    clearSearch();
    $('#searchInput').blur();
  }
});

$$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeForm));
$$('[data-close-view]').forEach((el) => el.addEventListener('click', closeView));
$$('[data-close-login]').forEach((el) => el.addEventListener('click', closeLogin));

$('#recipeForm').addEventListener('submit', handleSubmit);
$('#loginForm').addEventListener('submit', handleLogin);

$('#category').addEventListener('change', (e) => {
  const isCustom = e.target.value === '__custom__';
  $('#customCategoryField').classList.toggle('hidden', !isCustom);
  if (isCustom) $('#customCategory').focus();
});

$('#image').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const preview = $('#imagePreview');
  if (!file) return;
  try {
    const dataUrl = await processImage(file);
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    delete preview.dataset.existing;
  } catch (err) {
    alert(err.message);
    e.target.value = '';
  }
});

$('#editBtn').addEventListener('click', () => {
  const r = recipes.find((x) => x.id === viewingId);
  if (!r) return;
  closeView();
  openForm(r);
});

$('#deleteBtn').addEventListener('click', async () => {
  if (!viewingId) return;
  const r = recipes.find((x) => x.id === viewingId);
  if (!r) return;
  if (!confirm(`¿Eliminar la receta "${r.title}"?`)) return;
  try {
    await deleteRecipeRow(viewingId);
    recipes = recipes.filter((x) => x.id !== viewingId);
    render();
    closeView();
  } catch (err) {
    alert('Error al eliminar: ' + (err?.message || err));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#recipeModal').classList.contains('hidden')) closeForm();
  else if (!$('#viewModal').classList.contains('hidden')) closeView();
  else if (!$('#loginModal').classList.contains('hidden')) closeLogin();
});

// ---------- Init ----------
(async function init() {
  try {
    await checkAuth();
    await loadRecipes();
    render();
  } catch (err) {
    console.error('Init error:', err);
    const loading = $('#loadingState');
    loading.innerHTML = `
      <p class="empty-title" style="color:#b3261e">Error de conexión</p>
      <p class="empty-sub">${escapeHtml(err?.message || String(err))}</p>
      <p class="empty-sub" style="margin-top:1rem">Abrí la consola (Cmd+Option+I) y revisá los detalles.</p>
    `;
  }
})();
