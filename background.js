const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// In-memory token cache (cleared when service worker sleeps)
let cachedToken = null;
let tokenExpiry = 0;

// ─── Auth ──────────────────────────────────────────────────────────────────────

async function getStoredClientId() {
  const { clientId } = await chrome.storage.local.get('clientId');
  return clientId || null;
}

async function launchOAuthFlow(clientId) {
  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly');

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      responseUrl => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const params = new URLSearchParams(new URL(responseUrl).hash.slice(1));
        const token = params.get('access_token');
        if (!token) reject(new Error('No access token in response'));
        else resolve(token);
      }
    );
  });
}

async function getToken() {
  // Check in-memory cache (1 min buffer before expiry)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  // Check session storage (survives service worker sleep)
  const stored = await chrome.storage.session.get(['token', 'tokenExpiry']);
  if (stored.token && Date.now() < (stored.tokenExpiry || 0) - 60_000) {
    cachedToken = stored.token;
    tokenExpiry = stored.tokenExpiry;
    return cachedToken;
  }

  const clientId = await getStoredClientId();
  if (!clientId) {
    throw new Error('API not configured. Click "Configure" and upload your credentials JSON.');
  }

  const token = await launchOAuthFlow(clientId);
  cachedToken = token;
  tokenExpiry = Date.now() + 3600 * 1000; // tokens last 1 hour
  await chrome.storage.session.set({ token, tokenExpiry });
  return token;
}

// ─── Gmail API ────────────────────────────────────────────────────────────────

async function apiFetch(token, url) {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 401) throw new Error('AUTH_EXPIRED');
  if (!resp.ok) throw new Error(`Gmail API error: ${resp.status}`);
  return resp.json();
}

function parseFrom(from) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<[^>]+>/, '').trim() || from;
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function matchesPatterns(msg, patterns) {
  const { subjectStr, bodyStr, anyStr } = patterns;
  try {
    if (subjectStr && !new RegExp(subjectStr, 'i').test(msg.subject)) return false;
    if (bodyStr && !new RegExp(bodyStr, 'i').test(msg.snippet)) return false;
    if (anyStr && !new RegExp(anyStr, 'i').test(`${msg.from} ${msg.subject} ${msg.snippet}`)) return false;
  } catch {
    return false;
  }
  return true;
}

async function listMessageIds(token, maxResults) {
  const ids = [];
  let pageToken = null;
  while (ids.length < maxResults) {
    const batch = Math.min(100, maxResults - ids.length);
    let url = `${GMAIL_API}/messages?labelIds=INBOX&maxResults=${batch}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const data = await apiFetch(token, url);
    if (data.messages) ids.push(...data.messages.map(m => m.id));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids;
}

async function fetchMetadata(token, id) {
  const url = `${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`;
  const data = await apiFetch(token, url);
  const headers = {};
  for (const h of (data.payload?.headers || [])) headers[h.name.toLowerCase()] = h.value;
  return {
    id: data.id,
    subject: headers['subject'] || '(no subject)',
    from: parseFrom(headers['from'] || ''),
    snippet: decodeHtml(data.snippet || ''),
  };
}

async function searchInbox(patterns, maxResults) {
  let token;
  try {
    token = await getToken();
  } catch (e) {
    // Clear expired cache and retry once
    if (e.message === 'AUTH_EXPIRED') {
      cachedToken = null;
      tokenExpiry = 0;
      await chrome.storage.session.remove(['token', 'tokenExpiry']);
      token = await getToken();
    } else {
      throw e;
    }
  }

  const ids = await listMessageIds(token, maxResults);
  const results = [];
  const CONCURRENCY = 20;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const details = await Promise.all(batch.map(id => fetchMetadata(token, id).catch(() => null)));
    results.push(...details.filter(Boolean));
  }
  return results.filter(msg => matchesPatterns(msg, patterns));
}

// ─── Message handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_INBOX') {
    searchInbox(message.patterns, message.maxResults || 200)
      .then(results => sendResponse({ success: true, results }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_CLIENT_ID') {
    chrome.storage.local.set({ clientId: message.clientId }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_CLIENT_ID') {
    getStoredClientId().then(clientId => sendResponse({ clientId }));
    return true;
  }

  if (message.type === 'GET_REDIRECT_URL') {
    sendResponse({ redirectUrl: chrome.identity.getRedirectURL() });
    return false;
  }

  if (message.type === 'SIGN_OUT') {
    cachedToken = null;
    tokenExpiry = 0;
    chrome.storage.session.remove(['token', 'tokenExpiry'], () => sendResponse({ success: true }));
    return true;
  }
});
