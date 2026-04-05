# Gmail Regex Search

A Chrome extension that adds regex-powered email filtering to Gmail — filter the visible inbox in real time, or search your **entire inbox** via the Gmail API.

## Features

- **Live visible filtering** — instantly hides emails that don't match your regex as you type, no server requests
- **Full inbox search** — searches all emails via the Gmail API, not just what's loaded in the DOM
- **Three match targets** — Subject, Snippet (body preview), or Anywhere (sender + subject + snippet)
- **Clickable results** — API results link directly to each email in Gmail
- **Floating UI** — sits unobtrusively at the bottom-right corner of Gmail

## Installation

1. Download and unzip the [latest release](https://github.com/guberm/gmail-regex-search/releases/latest)
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the unzipped folder
5. Open [Gmail](https://mail.google.com) — the panel appears after a few seconds

## Usage

### Filter visible emails

Type any valid JS regex into the fields and emails hide/show instantly. Leave all fields empty to show everything.

| Field    | Matches against                     |
| -------- | ----------------------------------- |
| Subject  | Email subject line                  |
| Snippet  | Body preview text                   |
| Anywhere | Sender + subject + snippet combined |

Examples: `^Invoice`, `error\d+`, `\[Polymarket`

### Search all inbox (Gmail API)

To search beyond what's visible on screen, connect the Gmail API once:

#### 1. Create Google API credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. **APIs & Services → Library** → enable **Gmail API**
3. **APIs & Services → OAuth consent screen** → External → fill in name and emails → Save
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application** ⚠️ (not Chrome Extension, not Desktop app)
   - Under **Authorized redirect URIs**, click **Upload credentials.json** in the extension first — it will show you the exact URI to paste here
5. **Create → Download JSON**

#### 2. Configure the extension

1. In Gmail, click **Upload credentials.json** in the extension panel
2. Select the JSON file downloaded from Google Cloud
3. The button turns **✓ Configured**

> If you upload the wrong credential type, the extension will show the correct redirect URI to copy into Google Cloud Console.

#### 3. Search

Enter regex patterns and click **Search All Inbox**. On first use, Google will prompt you to authorize. Results appear as a scrollable list — click any to open the email.

> The extension requests read-only access (`gmail.readonly`). It never modifies or sends emails.

## File structure

```text
├── manifest.json     Chrome extension config (Manifest V3)
├── background.js     Service worker — Gmail API calls, OAuth token management
├── content.js        Injected into Gmail — UI, visible filter, API result display
├── style.css         Floating panel styles
└── icon128.png       Extension icon
```

## License

MIT
