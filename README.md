# Gmail Regex Search

Regex-powered Gmail search in two flavors: a **Chrome Extension** and a **Gmail Add-on** (Google Workspace).

---

## Chrome Extension

Adds regex filtering to Gmail — filter the visible inbox in real time, or search your entire inbox via the Gmail API.

### Features

- **Live visible filtering** — hides emails that don't match your regex as you type, no API calls
- **Full inbox search** — searches all emails via the Gmail API, not just what's loaded in the DOM
- **Three match targets** — Subject, Body/snippet, or Anywhere (sender + subject + snippet)
- **Clickable results** — links directly to each matching email
- **Native side panel** — uses Chrome's built-in side panel UI

### Installation

1. Download and unzip the [latest release](https://github.com/guberm/gmail-regex-search/releases/latest)
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `chrome-extension/` folder
5. Open [Gmail](https://mail.google.com) — click the extension icon to open the side panel

### Usage

#### Filter visible emails

Type any valid JS regex into the fields — emails hide/show instantly.

| Field    | Matches against                     |
| -------- | ----------------------------------- |
| Subject  | Email subject line                  |
| Body     | Body preview (snippet)              |
| Anywhere | Sender + subject + snippet combined |

Examples: `^Invoice`, `error\d+`, `\[Polymarket`

#### Search full inbox (Gmail API)

Requires a one-time OAuth setup:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or select a project
2. **APIs & Services → Library** → enable **Gmail API**
3. **OAuth consent screen** → External → fill in name/emails → Save
4. **Credentials → Create → OAuth 2.0 Client ID** → Application type: **Web application**
   - Open the extension panel first — it shows the exact redirect URI to paste
5. Download the JSON → click **Configure** in the extension → upload the file

On first search Google will prompt for authorization. The extension uses read-only access and never modifies or sends emails.

---

## Gmail Add-on (Google Apps Script)

A Google Workspace Add-on that runs natively inside Gmail — no Chrome required, works on web and mobile.

### Add-on Features

- **Gmail pre-filter** — use Gmail's own search syntax (`from:`, `after:`, `subject:`) to narrow scope, then apply regex on top
- **Full mailbox search** — paginates through all results from the query with no artificial cap
- **Three regex fields** — Subject, Body, Any field
- **Date in results** — each result shows sender, date, bold subject, and snippet
- **Collapsible Advanced section** — Gmail query is hidden by default, clean form for simple use
- **Timeout protection** — hard 25s cap with a visible warning; use a pre-filter to avoid it

### Setup

1. Go to [script.google.com](https://script.google.com) → **New project** → name it "Gmail Regex Search"
2. Copy the contents of `gmail-addon/Code.gs` into `Code.gs`
3. Open **Project Settings** → enable **"Show appsscript.json manifest file in editor"**
4. Replace the contents of `appsscript.json` with `gmail-addon/appsscript.json`
5. In **Project Settings → Google Cloud Platform** → set your GCP project number
6. In GCP: **APIs & Services → Library** → enable **Gmail API**
7. **Deploy → Test deployments → Google Workspace Add-on → Install**
8. Open Gmail — the add-on appears in the right sidebar

### Add-on Usage

| Field              | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| Subject            | Regex matched against email subject                          |
| Body               | Regex matched against full plain-text body                   |
| Any field          | Regex matched against sender + subject + snippet combined    |
| Gmail pre-filter   | Gmail search syntax — narrows scope before regex is applied  |

**Tips:**

- Leave Gmail pre-filter blank → searches all inbox (may time out for large mailboxes)
- Use `subject:keyword` or `from:email` to scope the search and avoid timeouts
- Combine both: Gmail query narrows to hundreds of emails, regex finds the exact ones

---

## File structure

```text
Gmail Regex Search/
├── chrome-extension/
│   ├── manifest.json       Chrome extension config (Manifest V3)
│   ├── background.js       Service worker — Gmail API, OAuth token management
│   ├── content.js          Injected into Gmail — visible filter logic
│   ├── sidepanel.html/js   Side panel UI
│   ├── sidepanel.css
│   ├── style.css
│   └── icon128.png
└── gmail-addon/
    ├── appsscript.json     Apps Script manifest — scopes, triggers
    └── Code.gs             Add-on UI (Card Service) + search logic
```

## License

MIT
