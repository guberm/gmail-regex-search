# Privacy Policy — Gmail Regex Search

**Last updated:** April 5, 2026

## Summary

Gmail Regex Search does not collect, store, or transmit any user data to third-party servers. All processing happens locally in your browser.

## What the extension accesses

- **Email metadata** (subject, sender name, snippet) — read locally from the Gmail page DOM or fetched via the Gmail API on your behalf. Used only to apply your regex patterns. Never stored, never transmitted outside your browser.
- **OAuth access token** — stored temporarily in `chrome.storage.session` (cleared automatically when the browser closes). Used to authenticate Gmail API requests made directly from your browser to Google.
- **OAuth client ID** — stored in `chrome.storage.local` so you don't need to re-upload your credentials file each session. This is your own Google Cloud credential, not ours.

## What the extension does NOT do

- Does not collect or log any personal data
- Does not transmit email content or metadata to any server other than Google
- Does not use analytics or tracking of any kind
- Does not share any data with third parties
- Does not store emails, search patterns, or results beyond the current session

## Third-party services

The extension communicates exclusively with **Google APIs** (`gmail.googleapis.com`) on your behalf, using credentials you supply. These requests are subject to [Google's Privacy Policy](https://policies.google.com/privacy).

## Data you provide

You upload a Google OAuth 2.0 client ID (from your own Google Cloud project) to enable Gmail API access. This value is stored locally on your device only.

## Contact

Questions? Open an issue at [github.com/guberm/gmail-regex-search](https://github.com/guberm/gmail-regex-search/issues).
