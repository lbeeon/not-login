const CACHE_TTL = 5 * 60 * 1000;

async function getToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(token);
    });
  });
}

async function removeCachedToken(token) {
  return new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
}

async function fetchWithAuth(url, options = {}) {
  const token = await getToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    await removeCachedToken(token);
    const freshToken = await getToken();
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${freshToken}` },
    });
  }
  return res;
}

async function getConfig() {
  return chrome.storage.local.get(['sheetId', 'tabName']);
}

async function ensureSheetExists(sheetId, tabName) {
  const metaRes = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`
  );
  if (!metaRes.ok) return;
  const meta = await metaRes.json();
  const exists = (meta.sheets || []).some(s => s.properties.title === tabName);
  if (exists) return;

  const addRes = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }) }
  );
  const addData = await addRes.json();
  const newSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A1:F1?valueInputOption=RAW`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['type', 'category', 'key', 'username', 'secret', 'notes']] }) }
  );

  if (newSheetId != null) {
    await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          repeatCell: {
            range: { sheetId: newSheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: ';;;' },
                textFormat: { foregroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } } }
              }
            },
            fields: 'userEnteredFormat.numberFormat,userEnteredFormat.textFormat.foregroundColorStyle'
          }
        }]
      })
    });
  }
}

async function fetchSecrets(sheetId, tabName) {
  await ensureSheetExists(sheetId, tabName);
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A2:F`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Sheets API error ${res.status}`);
  }
  const data = await res.json();
  return (data.values || []).map((row, i) => ({
    _row: i + 2, type: row[0] || '', category: row[1] || '',
    key: row[2] || '', username: row[3] || '', secret: row[4] || '', notes: row[5] || '',
  }));
}

async function readCurrentSecrets(sheetId, tabName) {
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A2:F`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Sheets API error ${res.status}`);
  }
  const data = await res.json();
  return (data.values || []).map((row, i) => ({
    _row: i + 2, type: row[0] || '', category: row[1] || '',
    key: row[2] || '', username: row[3] || '', secret: row[4] || '', notes: row[5] || '',
  }));
}

function findRow(secrets, original) {
  return secrets.find(s =>
    s.key === original.key &&
    s.type === original.type &&
    s.category === original.category &&
    s.username === original.username
  ) || null;
}

async function getNumericSheetId(sheetId, tabName) {
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`
  );
  const data = await res.json();
  return (data.sheets || []).find(s => s.properties.title === tabName)?.properties?.sheetId;
}

async function appendSecret(sheetId, tabName, entry) {
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A:F:append?valueInputOption=RAW`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[entry.type, entry.category, entry.key, entry.username, entry.secret, entry.notes]] }) }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Sheets API error ${res.status}`);
  }
}

async function updateSecret(sheetId, tabName, row, entry) {
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A${row}:F${row}?valueInputOption=RAW`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[entry.type, entry.category, entry.key, entry.username, entry.secret, entry.notes]] }) }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Sheets API error ${res.status}`);
  }
}

async function deleteSecret(sheetId, tabName, row) {
  const numericSheetId = await getNumericSheetId(sheetId, tabName);
  const res = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ deleteDimension: {
        range: { sheetId: numericSheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row }
      }}] }) }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Sheets API error ${res.status}`);
  }
}

async function getSecrets() {
  const { secrets, secretsAt } = await chrome.storage.session.get(['secrets', 'secretsAt']);
  if (secrets && Date.now() - secretsAt < CACHE_TTL) return secrets;
  const { sheetId, tabName = 'secrets' } = await getConfig();
  if (!sheetId) throw new Error('NOT_CONFIGURED');
  const fresh = await fetchSecrets(sheetId, tabName);
  await chrome.storage.session.set({ secrets: fresh, secretsAt: Date.now() });
  return fresh;
}

async function invalidateCache() {
  await chrome.storage.session.remove(['secrets', 'secretsAt']);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SECRETS') {
    getSecrets()
      .then(secrets => sendResponse({ ok: true, secrets }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'APPEND_SECRET') {
    (async () => {
      const { sheetId, tabName = 'secrets' } = await getConfig();
      if (!sheetId) throw new Error('NOT_CONFIGURED');
      await appendSecret(sheetId, tabName, msg.entry);
      await invalidateCache();
      sendResponse({ ok: true });
    })().catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'UPDATE_SECRET') {
    (async () => {
      const { sheetId, tabName = 'secrets' } = await getConfig();
      if (!sheetId) throw new Error('NOT_CONFIGURED');
      const fresh = await readCurrentSecrets(sheetId, tabName);
      const match = findRow(fresh, msg.original);
      if (!match) throw new Error('Entry not found in Sheet — it may have moved. Please refresh and try again.');
      await updateSecret(sheetId, tabName, match._row, msg.entry);
      await invalidateCache();
      sendResponse({ ok: true });
    })().catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'DELETE_SECRET') {
    (async () => {
      const { sheetId, tabName = 'secrets' } = await getConfig();
      if (!sheetId) throw new Error('NOT_CONFIGURED');
      const fresh = await readCurrentSecrets(sheetId, tabName);
      const match = findRow(fresh, msg.original);
      if (!match) throw new Error('Entry not found in Sheet — it may have moved. Please refresh and try again.');
      await deleteSecret(sheetId, tabName, match._row);
      await invalidateCache();
      sendResponse({ ok: true });
    })().catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
