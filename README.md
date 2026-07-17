# Not Login

> Google Password Manager handles your web logins. **Not Login handles everything else.**

Wi-Fi passwords, bank PINs, door codes, API keys — the secrets that don't fit in a password manager. Not Login stores them in **your own Google Sheet**, so your data never touches a third-party server.

---

## What it does

- **Store & retrieve** physical-world secrets organized by category
- **Copy in one click** — username and password fields with clipboard feedback
- **Reveal in place** — eye toggle shows the secret inline, auto-hides after 8 seconds
- **Edit & delete** directly from the popup
- **Autofill** for `type=website` entries on matching websites
- **Your data, your Sheet** — Not Login is just a UI on top of a spreadsheet you own

---

## Setup

### 1. Install the extension

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/not-login/dnebaaknbmjhbnjdpjhlonfkekblbkni) or load unpacked for development (see below).

### 2. Create your vault

Click the **⚙** icon in the popup, then **Create new vault**. The extension creates a Google Sheet in your Drive and sets it up automatically — no manual steps needed.

### 3. Add secrets

Tap **+** to add an entry, or type directly in the Sheet and tap **↻** to refresh.

---

## Google Sheet Schema

The extension manages a tab (default: `secrets`) with these columns:

| Column | Description |
|--------|-------------|
| `type` | `general` or `website` |
| `category` | Grouping label — e.g. `wifi`, `bank`, `api-key` |
| `key` | Domain for `website` (e.g. `github.com`), or a name for `general` (e.g. `home wifi`) |
| `username` | Optional |
| `secret` | Required |
| `notes` | Optional |

You can edit the Sheet directly — hit **↻** in the popup to refresh.

---

## Development

```bash
git clone https://github.com/lbeeon/not-login.git
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the project folder

### Fixing the extension ID for local development

When loaded unpacked, Chrome assigns a random extension ID. Since the OAuth 2.0 client is registered to the CWS extension ID (`dnebaaknbmjhbnjdpjhlonfkekblbkni`), authentication will fail unless the local extension uses the same ID.

Add the following `key` field to `manifest.json` (do **not** commit it):

```json
"key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt2UjFdNyszrlzPL+Xs88YRWkHoCBljXelNwTd2b51BYeDUutYOuTfht2PjP9AgX6wWkjUsHLeK9FsWXRYqsTOZJsJrERQYoMRbbv8vEd6TPF3n0dbuEEXe5FMuzTc00ub7ttPm6zfsL5M4ntPxxht5GRpA8lTgIskLbAibYdcm5tdex1vYzXVc1+uT3bpcmJqB44UgfOspPBdoUrunfpUcjG3bbhsjc5eTCBx4lLRaXB/w6JQdyfrGB/FbYmQ45BEomt7SYK7QXN+SwSysy7kgBmI7650q8hjYzYKYUOn+VRn07ASNxV5/wY0MDZ+KXGwvCyShr6jerrOhoYo1GQpQIDAQAB",
```

Then tell git to ignore local changes to this file:

```bash
git update-index --skip-worktree manifest.json
```

**When bumping the version:**

```bash
git update-index --no-skip-worktree manifest.json  # re-enable tracking
# remove the key field, update version
git add manifest.json && git commit
git update-index --skip-worktree manifest.json      # lock again
# add the key field back locally
```

### Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com) → Create a project
2. Enable **Google Sheets API** and **Google Drive API**
3. Create an **OAuth 2.0 Client ID** → Chrome Extension type → set extension ID to `dnebaaknbmjhbnjdpjhlonfkekblbkni`
4. Add yourself as a Test User on the OAuth consent screen

---

## Permissions

| Permission | Reason |
|------------|--------|
| `identity` | Google OAuth 2.0 authentication via `chrome.identity` |
| `storage` | Syncs vault reference across devices (`storage.sync`); caches secrets for 5 minutes (`storage.session`); saves preferences locally (`storage.local`) |
| `activeTab` | Reads the current page's hostname for autofill matching |
| `clipboardWrite` | Copies secrets to clipboard when the user clicks a field |
| `https://sheets.googleapis.com/*` | Calls the Google Sheets API to read, write, update, and delete secrets |
| `https://www.googleapis.com/*` | Calls the Google Drive API to create and list vault spreadsheets |
| `<all_urls>` | Injects the autofill icon next to password fields on any HTTPS website |

---

## Privacy

Not Login has no server. Your secrets live in your Google Account and your browser's local storage only. See the full [Privacy Policy](./docs/privacy-policy.html).

---

## Support

If Not Login saves you time, consider buying me a coffee ☕

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/lbeeon)

---

## License

MIT
