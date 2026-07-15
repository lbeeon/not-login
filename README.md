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

### Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com) → Create a project
2. Enable **Google Sheets API**
3. Create an **OAuth 2.0 Client ID** → Chrome Extension type
4. Add your extension ID to the allowed origins
5. Add yourself as a Test User on the OAuth consent screen

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
