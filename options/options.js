chrome.storage.local.get(['sheetId', 'tabName'], ({ sheetId, tabName }) => {
  if (sheetId) document.getElementById('sheetId').value = sheetId;
  document.getElementById('tabName').value = tabName || 'secrets';
});

document.getElementById('save').addEventListener('click', async () => {
  const sheetId = document.getElementById('sheetId').value.trim();
  const tabName = document.getElementById('tabName').value.trim() || 'secrets';

  if (!sheetId) {
    showStatus('Sheet ID is required', 'error');
    return;
  }

  await chrome.storage.local.set({ sheetId, tabName });
  await chrome.storage.session.remove(['secrets', 'secretsAt']);
  showStatus('Saved ✓', 'success');
});

document.getElementById('test').addEventListener('click', async () => {
  const sheetId = document.getElementById('sheetId').value.trim();
  const tabName = document.getElementById('tabName').value.trim() || 'secrets';

  if (!sheetId) {
    showStatus('Enter a Sheet ID first', 'error');
    return;
  }

  showStatus('Connecting...', 'info');

  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, t => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(t);
      });
    });

    // Check spreadsheet accessibility
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
    const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaRes.ok) {
      const body = await metaRes.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${metaRes.status}`);
    }
    const meta = await metaRes.json();
    const tabs = (meta.sheets || []).map(s => s.properties.title);
    const hasTab = tabs.includes(tabName);

    if (!hasTab) {
      showStatus(`Connected ✓  —  tab "${tabName}" not found, will be created on first use. Existing tabs: ${tabs.join(', ') || '(none)'}`, 'success');
    } else {
      showStatus(`Connected ✓  —  tab "${tabName}" found`, 'success');
    }
  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  }
});

function showStatus(msg, type = 'info') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = type;
}
