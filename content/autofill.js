function detectLoginForm() {
  document.querySelectorAll('input[type="password"]').forEach(pwField => {
    if (pwField.dataset.notloginAttached) return;
    const form = pwField.closest('form');
    const usernameField = form
      ? form.querySelector('input[type="text"], input[type="email"]')
      : null;
    injectIcon(pwField, usernameField);
    pwField.dataset.notloginAttached = 'true';
  });
}

function injectIcon(pwField, usernameField) {
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('icons/16.png');
  icon.style.cssText = `
    position: fixed;
    cursor: pointer;
    z-index: 2147483646;
    width: 16px;
    height: 16px;
    opacity: 0.6;
    transition: opacity 0.15s;
    pointer-events: auto;
  `;

  document.body.appendChild(icon);

  function reposition() {
    const r = pwField.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      icon.style.display = 'none';
      return;
    }
    icon.style.display = '';
    icon.style.top  = (r.top + (r.height - 16) / 2) + 'px';
    icon.style.left = (r.right - 22) + 'px';
  }

  reposition();
  window.addEventListener('scroll', reposition, { passive: true, capture: true });
  window.addEventListener('resize', reposition, { passive: true });

  icon.addEventListener('mouseenter', () => (icon.style.opacity = '1'));
  icon.addEventListener('mouseleave', () => (icon.style.opacity = '0.6'));
  icon.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    showAutofillMenu(icon, pwField, usernameField);
  });
}

async function showAutofillMenu(anchor, pwField, usernameField) {
  document.querySelectorAll('.notlogin-menu').forEach(m => m.remove());

  const domain = window.location.hostname;

  let secrets;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_SECRETS' });
    if (!res.ok) return;
    secrets = res.secrets;
  } catch {
    return;
  }

  const matches = secrets.filter(s =>
    s.type === 'website' && (
      s.key === domain ||
      domain.endsWith('.' + s.key) ||
      s.key.endsWith('.' + domain)
    )
  );

  const menu = document.createElement('div');
  menu.className = 'notlogin-menu';
  menu.style.cssText = `
    position: fixed;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 4px 0;
    z-index: 2147483647;
    min-width: 200px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #e0e0e0;
  `;

  if (matches.length === 0) {
    const msg = document.createElement('div');
    msg.style.cssText = 'padding:8px 12px;color:#555;';
    msg.textContent = `No matches for ${domain}`;
    menu.appendChild(msg);
  } else {
    matches.forEach(s => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;';

      const nameEl = document.createElement('span');
      nameEl.style.fontWeight = '600';
      nameEl.textContent = s.username || s.key;

      item.appendChild(nameEl);

      if (s.notes) {
        const notesEl = document.createElement('span');
        notesEl.style.cssText = 'color:#555;font-size:11px;';
        notesEl.textContent = s.notes;
        item.appendChild(notesEl);
      }

      item.addEventListener('mouseenter', () => (item.style.background = '#2a2a2a'));
      item.addEventListener('mouseleave', () => (item.style.background = ''));
      item.addEventListener('click', () => {
        if (usernameField) usernameField.value = s.username;
        pwField.value = s.secret;
        [usernameField, pwField].filter(Boolean).forEach(f => {
          f.dispatchEvent(new Event('input', { bubbles: true }));
          f.dispatchEvent(new Event('change', { bubbles: true }));
        });
        menu.remove();
      });

      menu.appendChild(item);
    });
  }

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;

  // keep menu inside viewport
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
  }

  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 0);
}

detectLoginForm();

const observer = new MutationObserver(detectLoginForm);
observer.observe(document.body, { childList: true, subtree: true });
