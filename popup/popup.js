let allSecrets = [];
let activeCategory = null;
let editingEntry = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupAddForm();
  setupSearch();
  setupSettings();
  setupIdleTimeout();
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await chrome.storage.session.remove(['secrets', 'secretsAt']);
    await loadAndRender();
  });
  await loadAndRender();
});

// ── Load & Render ──────────────────────────────────────────────────────────────

async function loadAndRender() {
  showStatus('Loading...');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_SECRETS' });
    if (!res.ok) {
      if (res.error === 'NOT_CONFIGURED') {
        showStatus('<a href="#" id="open-settings">Set up your vault →</a>');
        document.getElementById('open-settings').addEventListener('click', e => {
          e.preventDefault();
          openSettings();
        });
      } else {
        showStatus(`Error: ${res.error}`);
      }
      return;
    }
    allSecrets = res.secrets;
    activeCategory = null;
    clearStatus();
    renderChips(allSecrets);
    renderList(allSecrets);
  } catch (err) {
    showStatus(`Error: ${err.message}`);
  }
}

function renderList(secrets) {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '';

  if (secrets.length === 0) {
    const el = document.createElement('div');
    el.className = 'empty';
    if (allSecrets.length === 0) {
      el.innerHTML = 'No secrets yet.<br><small>Tap <strong>+</strong> to add one, or enter data directly in your Google Sheet and tap <strong>↻</strong> to refresh.</small>';
    } else {
      el.textContent = 'No matches';
    }
    listEl.appendChild(el);
    return;
  }

  groupSecrets(secrets).forEach(({ label, items }) => {
    const groupEl = document.createElement('div');
    groupEl.className = label === 'web' ? 'group group-web' : 'group';

    const headerEl = document.createElement('div');
    headerEl.className = 'group-header';
    headerEl.textContent = label;
    groupEl.appendChild(headerEl);

    items.forEach(s => groupEl.appendChild(createItemEl(s)));
    listEl.appendChild(groupEl);
  });
}

function groupSecrets(secrets) {
  const map = new Map();
  secrets.forEach(s => {
    const key = s.type === 'website' ? 'web' : (s.category || 'other');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  });

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === 'web') return 1;
      if (b === 'web') return -1;
      return a.localeCompare(b);
    })
    .map(([label, items]) => ({ label, items }));
}

function createItemEl(s) {
  const wrap = document.createElement('div');
  wrap.className = 'item-wrap';

  const row = document.createElement('div');
  row.className = 'item';

  // ── Info (left) ──
  const infoEl = document.createElement('div');
  infoEl.className = 'item-info';

  const nameEl = document.createElement('span');
  nameEl.className = 'item-name';
  nameEl.textContent = s.key;
  infoEl.appendChild(nameEl);

  if (s.notes) {
    const notesEl = document.createElement('span');
    notesEl.className = 'item-notes';
    notesEl.textContent = s.notes;
    infoEl.appendChild(notesEl);
  }

  // Edit / Delete buttons (visible on hover)
  const editActionsEl = document.createElement('div');
  editActionsEl.className = 'item-edit-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-item-action';
  editBtn.textContent = '✎';
  editBtn.addEventListener('click', () => openEditForm(s));

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-item-action btn-delete';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', () => handleDelete(s, delBtn));

  editActionsEl.appendChild(editBtn);
  editActionsEl.appendChild(delBtn);
  infoEl.appendChild(editActionsEl);

  // ── Actions (right) ──
  const actionsEl = document.createElement('div');
  actionsEl.className = 'item-actions';

  if (s.username) {
    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.readOnly = true;
    userInput.value = s.username;
    userInput.className = 'input-reveal';
    userInput.title = s.username;
    userInput.addEventListener('click', () => copyInputValue(userInput));
    actionsEl.appendChild(userInput);
  }

  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.readOnly = true;
  passInput.value = s.secret;
  passInput.className = 'input-reveal input-secret';
  passInput.addEventListener('click', () => copyInputValue(passInput));

  let revealTimer = null;
  const eyeBtn = document.createElement('button');
  eyeBtn.className = 'btn-eye';
  eyeBtn.textContent = '👁';
  eyeBtn.addEventListener('click', () => {
    const revealed = passInput.type === 'text';
    clearTimeout(revealTimer);
    if (revealed) {
      passInput.type = 'password';
      eyeBtn.classList.remove('active');
    } else {
      passInput.type = 'text';
      eyeBtn.classList.add('active');
      revealTimer = setTimeout(() => {
        passInput.type = 'password';
        eyeBtn.classList.remove('active');
      }, 8000);
    }
  });

  actionsEl.appendChild(passInput);
  actionsEl.appendChild(eyeBtn);

  row.appendChild(infoEl);
  row.appendChild(actionsEl);
  wrap.appendChild(row);
  return wrap;
}

async function copyInputValue(input) {
  await navigator.clipboard.writeText(input.value);
  input.classList.add('copied');
  setTimeout(() => input.classList.remove('copied'), 1000);
}

// ── Chips ─────────────────────────────────────────────────────────────────────

function renderChips(secrets) {
  const container = document.getElementById('filter-chips');
  container.innerHTML = '';

  const categories = [...new Set(secrets.map(s => s.type === 'website' ? 'web' : (s.category || 'other')))];
  if (categories.length <= 1) return;

  ['all', ...categories.sort((a, b) => {
    if (a === 'web') return 1;
    if (b === 'web') return -1;
    return a.localeCompare(b);
  })].forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (cat === 'all' && !activeCategory ? ' active' : cat === activeCategory ? ' active' : '');
    chip.textContent = cat;
    chip.addEventListener('click', () => {
      activeCategory = cat === 'all' ? null : cat;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyFilters();
    });
    container.appendChild(chip);
  });
}

// ── Search ────────────────────────────────────────────────────────────────────

function setupSearch() {
  document.getElementById('search').addEventListener('input', applyFilters);
}

function applyFilters() {
  const query = document.getElementById('search').value;
  let results = filterSecrets(allSecrets, query);
  if (activeCategory) {
    results = results.filter(s => {
      const cat = s.type === 'website' ? 'web' : (s.category || 'other');
      return cat === activeCategory;
    });
  }
  renderList(results);
}

function filterSecrets(secrets, query) {
  if (!query) return secrets;
  const q = query.toLowerCase();
  return secrets.filter(s =>
    [s.key, s.category, s.username, s.notes].some(f => f.toLowerCase().includes(q))
  );
}

// ── Add / Edit Form ───────────────────────────────────────────────────────────

let formVisible = false;

function setupAddForm() {
  document.getElementById('add-btn').addEventListener('click', () => {
    editingEntry = null;
    if (!formVisible) toggleForm();
  });
  document.getElementById('cancel-btn').addEventListener('click', toggleForm);
  document.getElementById('type-select').addEventListener('change', handleTypeChange);
  document.getElementById('save-btn').addEventListener('click', handleSave);
  handleTypeChange();
}

function setListVisible(visible) {
  const v = visible ? '' : 'none';
  document.querySelector('.search-row').style.display = v;
  document.getElementById('filter-chips').style.display = v;
  document.getElementById('list').style.display = v;
}

function toggleForm() {
  formVisible = !formVisible;
  document.getElementById('add-form').style.display = formVisible ? 'block' : 'none';
  setListVisible(!formVisible);
  if (formVisible) {
    document.getElementById('key-input').focus();
  } else {
    resetForm();
  }
}

function openEditForm(entry) {
  editingEntry = entry;
  document.getElementById('type-select').value = entry.type;
  document.getElementById('category-input').value = entry.category;
  document.getElementById('key-input').value = entry.key;
  document.getElementById('username-input').value = entry.username;
  document.getElementById('secret-input').value = entry.secret;
  document.getElementById('notes-input').value = entry.notes;
  document.getElementById('form-label').textContent = `Editing: ${entry.key}`;
  document.getElementById('form-error').textContent = '';
  handleTypeChange();
  if (!formVisible) {
    formVisible = true;
    document.getElementById('add-form').style.display = 'block';
  }
  setListVisible(false);
  document.getElementById('key-input').focus();
}

function handleTypeChange() {
  const type = document.getElementById('type-select').value;
  document.getElementById('category-row').style.display = type === 'general' ? 'flex' : 'none';
  document.getElementById('key-input').placeholder = type === 'website' ? 'github.com' : 'name';
}

function resetForm() {
  editingEntry = null;
  ['key-input', 'category-input', 'username-input', 'secret-input', 'notes-input']
    .forEach(id => (document.getElementById(id).value = ''));
  document.getElementById('type-select').value = 'general';
  document.getElementById('form-label').textContent = '';
  document.getElementById('form-error').textContent = '';
  const btn = document.getElementById('save-btn');
  btn.disabled = false;
  btn.textContent = 'Save';
  handleTypeChange();
}

async function handleSave() {
  const type = document.getElementById('type-select').value;
  const entry = {
    type,
    category: document.getElementById('category-input').value.trim(),
    key:      document.getElementById('key-input').value.trim(),
    username: document.getElementById('username-input').value.trim(),
    secret:   document.getElementById('secret-input').value,
    notes:    document.getElementById('notes-input').value.trim(),
  };

  if (!entry.key) { setFormError('key is required'); return; }
  if (!entry.secret) { setFormError('secret is required'); return; }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  setFormError('');

  try {
    let res;
    if (editingEntry) {
      const original = { key: editingEntry.key, type: editingEntry.type, category: editingEntry.category, username: editingEntry.username };
      res = await chrome.runtime.sendMessage({ type: 'UPDATE_SECRET', original, entry });
    } else {
      res = await chrome.runtime.sendMessage({ type: 'APPEND_SECRET', entry });
    }
    if (!res.ok) throw new Error(res.error);
    toggleForm();
    await loadAndRender();
  } catch (err) {
    setFormError(err.message);
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

function handleDelete(entry, delBtn) {
  const wrap = delBtn.closest('.item-wrap');
  if (wrap.querySelector('.confirm-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'confirm-bar';

  const label = document.createElement('span');
  label.className = 'confirm-label';
  label.textContent = `Delete "${entry.key}"?`;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'confirm-cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Delete';
  confirmBtn.className = 'confirm-delete';

  bar.appendChild(label);
  bar.appendChild(cancelBtn);
  bar.appendChild(confirmBtn);
  wrap.appendChild(bar);

  let autoClose;

  function dismiss() {
    clearTimeout(autoClose);
    bar.remove();
  }

  cancelBtn.addEventListener('click', dismiss);

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '...';
    try {
      const original = { key: entry.key, type: entry.type, category: entry.category, username: entry.username };
      const res = await chrome.runtime.sendMessage({ type: 'DELETE_SECRET', original });
      if (!res.ok) throw new Error(res.error);
      if (formVisible) toggleForm();
      await loadAndRender();
    } catch (err) {
      setFormError(err.message);
      dismiss();
    }
  });

  autoClose = setTimeout(dismiss, 3000);
}

// ── Settings ──────────────────────────────────────────────────────────────────

function setupSettings() {
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('back-btn').addEventListener('click', closeSettings);
  document.getElementById('cfg-create').addEventListener('click', handleCreateVault);
  document.getElementById('vault-change').addEventListener('click', () => showVaultSetup(true));
  document.getElementById('cfg-autofill').addEventListener('change', e => {
    chrome.storage.local.set({ autofillEnabled: e.target.checked });
  });
}

async function openSettings() {
  if (formVisible) toggleForm();
  const { sheetId, vaultTitle } = await chrome.storage.sync.get(['sheetId', 'vaultTitle']);
  const { autofillEnabled } = await chrome.storage.local.get('autofillEnabled');
  document.getElementById('cfg-autofill').checked = !!autofillEnabled;
  document.getElementById('cfg-status').textContent = '';
  if (sheetId) {
    showVaultConnected(sheetId, vaultTitle || 'Not Login Vault');
  } else {
    showVaultSetup(false);
    loadVaultList();
  }
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('settings-view').style.display = 'block';
  document.getElementById('header-main').style.display = 'none';
  document.getElementById('header-settings').style.display = 'flex';
  document.getElementById('header-title').textContent = 'Settings';
}

function closeSettings() {
  document.getElementById('settings-view').style.display = 'none';
  document.getElementById('main-view').style.display = 'block';
  document.getElementById('header-settings').style.display = 'none';
  document.getElementById('header-main').style.display = 'flex';
  document.getElementById('header-title').textContent = 'Not Login';
}

function showVaultConnected(sheetId, title) {
  document.getElementById('vault-connected').style.display = 'block';
  document.getElementById('vault-setup').style.display = 'none';
  document.getElementById('vault-title-display').textContent = title;
  document.getElementById('vault-open-link').href =
    `https://docs.google.com/spreadsheets/d/${sheetId}`;
}

function showVaultSetup(loadList) {
  document.getElementById('vault-connected').style.display = 'none';
  document.getElementById('vault-setup').style.display = 'block';
  document.getElementById('vault-list-section').style.display = 'none';
  document.getElementById('vault-list').innerHTML = '';
  document.getElementById('cfg-create').disabled = false;
  document.getElementById('cfg-create').textContent = 'Create new vault';
  if (loadList) loadVaultList();
}

async function loadVaultList() {
  const res = await chrome.runtime.sendMessage({ type: 'LIST_VAULTS' });
  if (!res.ok || res.vaults.length === 0) return;
  const listEl = document.getElementById('vault-list');
  listEl.innerHTML = '';
  res.vaults.forEach(v => {
    const row = document.createElement('div');
    row.className = 'vault-row';
    const nameEl = document.createElement('span');
    nameEl.textContent = v.name;
    const btn = document.createElement('button');
    btn.className = 'btn-settings';
    btn.textContent = 'Connect';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '...';
      const r = await chrome.runtime.sendMessage({ type: 'CONNECT_VAULT', sheetId: v.id, title: v.name });
      if (r.ok) { closeSettings(); loadAndRender(); }
      else { setCfgStatus(`Error: ${r.error}`, 'error'); btn.disabled = false; btn.textContent = 'Connect'; }
    });
    row.appendChild(nameEl);
    row.appendChild(btn);
    listEl.appendChild(row);
  });
  document.getElementById('vault-list-section').style.display = 'block';
}

async function handleCreateVault() {
  const btn = document.getElementById('cfg-create');
  btn.disabled = true;
  btn.textContent = 'Creating...';
  setCfgStatus('Creating your vault in Google Drive...', 'info');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'CREATE_VAULT' });
    if (!res.ok) throw new Error(res.error);
    setCfgStatus('Vault created ✓', 'success');
    setTimeout(() => { closeSettings(); loadAndRender(); }, 800);
  } catch (err) {
    setCfgStatus(`Error: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Create new vault';
  }
}

// ── Idle Timeout ──────────────────────────────────────────────────────────────

function setupIdleTimeout() {
  let idleTimer = null;

  function hideRevealed() {
    document.querySelectorAll('.input-secret').forEach(input => {
      if (input.type === 'text') input.type = 'password';
    });
    document.querySelectorAll('.btn-eye.active').forEach(btn => btn.classList.remove('active'));
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(hideRevealed, 60 * 1000);
  }

  ['click', 'keydown', 'mousemove'].forEach(evt => document.addEventListener(evt, resetIdle));
  resetIdle();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showStatus(html) {
  document.getElementById('status').innerHTML = html;
}

function clearStatus() {
  document.getElementById('status').innerHTML = '';
}

function setFormError(msg) {
  document.getElementById('form-error').textContent = msg;
}

function setCfgStatus(msg, type = 'info') {
  const el = document.getElementById('cfg-status');
  el.textContent = msg;
  el.className = type;
}
