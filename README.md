# Gmail Regex Search

A Chrome extension that adds regex-powered email filtering to Gmail — filter the visible inbox in real time, or search your **entire inbox** via the Gmail API.

## Features

- **Live visible filtering** — instantly hides emails that don't match your regex as you type, no server requests
- **Full inbox search** — searches all emails via the Gmail API, not just what's loaded in the DOM
- **Three match targets** — Subject, Snippet (body preview), or Anywhere (sender + subject + snippet)
- **Clickable results** — API results link directly to each email in Gmail
- **Floating UI** — sits unobtrusively at the bottom-right corner of Gmail

## Installation

1. Clone or download this repo
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select this folder
5. Open [Gmail](https://mail.google.com) — the panel appears after a brief delay

## Usage

### Filter visible emails

Type any valid JS regex into the fields and emails hide/show instantly. Leave all fields empty to show everything.

| Field    | Matches against                      |
| -------- | ------------------------------------ |
| Subject  | Email subject line                   |
| Snippet  | Body preview text                    |
| Anywhere | Sender + subject + snippet combined  |

Examples: `^Invoice`, `error\d+`, `\[Polymarket`

### Search all inbox (Gmail API)

To search beyond the visible emails, you need to connect the Gmail API once:

#### 1. Create Google API credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Navigate to **APIs & Services → Library** → search for and enable **Gmail API**
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**, fill in App name, support email, developer email → Save
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Under **Authorized redirect URIs**, add:

     ```text
     https://<YOUR_EXTENSION_ID>.chromiumapp.org/
     ```

     Find your extension ID at `chrome://extensions/` (enable Developer mode to see it)
5. Click **Create** → **Download JSON** (saves a file like `client_secret_xxx.json`)

#### 2. Configure the extension

1. In Gmail, click **Configure API** (top-right of the extension panel)
2. Upload the JSON file you downloaded from Google Cloud
3. The button turns **✓ Configured**

#### 3. Search

Fill in your regex patterns and click **Search All Inbox**. On first use, Google will prompt you to authorize access. Results appear as a scrollable list — click any email to open it.

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
