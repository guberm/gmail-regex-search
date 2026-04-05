// ─── Tab helpers ───────────────────────────────────────────────────────────────

async function getGmailTab() {
  const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
  return tabs[0] || null;
}

async function sendToContent(message) {
  const tab = await getGmailTab();
  if (!tab) throw new Error('no-gmail');
  return chrome.tabs.sendMessage(tab.id, message);
}

// ─── Filter ────────────────────────────────────────────────────────────────────

const subjectInput = document.getElementById('regex-subject');
const bodyInput = document.getElementById('regex-body');
const anyInput = document.getElementById('regex-any');
const filterStatus = document.getElementById('filter-status');

function getPatterns() {
  return {
    subjectStr: subjectInput.value,
    bodyStr: bodyInput.value,
    anyStr: anyInput.value,
  };
}

let filterDebounce = null;

function scheduleFilter() {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(applyFilter, 300);
}

async function applyFilter() {
  const patterns = getPatterns();

  [subjectInput, bodyInput, anyInput].forEach(el => el.classList.remove('invalid'));
  filterStatus.className = 'filter-status';

  if (!patterns.subjectStr && !patterns.bodyStr && !patterns.anyStr) {
    filterStatus.textContent = '';
    try { await sendToContent({ type: 'CLEAR_FILTER' }); } catch {}
    return;
  }

  try {
    const resp = await sendToContent({ type: 'APPLY_FILTER', patterns });
    if (resp.success) {
      filterStatus.textContent = `${resp.matchCount} visible`;
    } else {
      filterStatus.textContent = 'Invalid regex';
      filterStatus.className = 'filter-status error';
      markInvalidInputs(patterns, resp.error);
    }
  } catch (e) {
    if (e.message === 'no-gmail') {
      filterStatus.textContent = 'Open Gmail first';
      filterStatus.className = 'filter-status error';
    }
  }
}

function markInvalidInputs(patterns, errorMsg) {
  // Try each pattern individually to find which one is invalid
  for (const [key, input] of [['subjectStr', subjectInput], ['bodyStr', bodyInput], ['anyStr', anyInput]]) {
    if (patterns[key]) {
      try { new RegExp(patterns[key]); } catch { input.classList.add('invalid'); }
    }
  }
}

subjectInput.addEventListener('input', scheduleFilter);
bodyInput.addEventListener('input', scheduleFilter);
anyInput.addEventListener('input', scheduleFilter);

// ─── Clear ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-clear').addEventListener('click', async () => {
  subjectInput.value = '';
  bodyInput.value = '';
  anyInput.value = '';
  filterStatus.textContent = '';
  filterStatus.className = 'filter-status';
  [subjectInput, bodyInput, anyInput].forEach(el => el.classList.remove('invalid'));
  clearResults();
  try { await sendToContent({ type: 'CLEAR_FILTER' }); } catch {}
});

// ─── Inbox search ──────────────────────────────────────────────────────────────

document.getElementById('btn-search-inbox').addEventListener('click', async () => {
  const patterns = getPatterns();
  if (!patterns.subjectStr && !patterns.bodyStr && !patterns.anyStr) {
    showMessage('Enter at least one regex pattern first.', 'error');
    return;
  }

  const btn = document.getElementById('btn-search-inbox');
  btn.disabled = true;
  showMessage('Searching inbox...', 'loading');

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'SEARCH_INBOX',
      patterns,
      maxResults: 200,
    });
    if (resp.success) {
      renderResults(resp.results);
    } else {
      showMessage(`Error: ${resp.error}`, 'error');
    }
  } catch (e) {
    showMessage(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ─── Results ───────────────────────────────────────────────────────────────────

function renderResults(results) {
  const panel = document.getElementById('results');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'results-header';
  header.textContent = results.length === 0
    ? 'No matches found.'
    : `${results.length} match${results.length === 1 ? '' : 'es'} in inbox`;
  panel.appendChild(header);

  for (const r of results) {
    const a = document.createElement('a');
    a.className = 'result-item';
    a.href = `https://mail.google.com/mail/u/0/#inbox/${r.id}`;
    a.target = '_blank';

    const from = document.createElement('div');
    from.className = 'result-from';
    from.textContent = r.from;

    const subject = document.createElement('div');
    subject.className = 'result-subject';
    subject.textContent = r.subject;

    const snippet = document.createElement('div');
    snippet.className = 'result-snippet';
    snippet.textContent = r.snippet;

    a.append(from, subject, snippet);
    panel.appendChild(a);
  }
}

function showMessage(text, type = '') {
  const panel = document.getElementById('results');
  panel.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = `results-message ${type}`;
  msg.textContent = text;
  panel.appendChild(msg);
}

function clearResults() {
  document.getElementById('results').innerHTML = '';
}

// ─── Credentials upload ────────────────────────────────────────────────────────

const credsInput = document.getElementById('creds-input');
const configureBtn = document.getElementById('btn-configure');

configureBtn.addEventListener('click', () => credsInput.click());

credsInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  try {
    const json = JSON.parse(await file.text());
    const credType = Object.keys(json)[0];
    const clientId = json.web?.client_id || json.installed?.client_id || json.client_id;

    if (!clientId) {
      showMessage('Could not find client_id in that file.', 'error');
      return;
    }

    if (credType !== 'web') {
      const { redirectUrl } = await chrome.runtime.sendMessage({ type: 'GET_REDIRECT_URL' });
      showRedirectUriHelp(redirectUrl);
      return;
    }

    await chrome.runtime.sendMessage({ type: 'SAVE_CLIENT_ID', clientId });
    configureBtn.textContent = '✓ Configured';
    configureBtn.classList.add('configured');
    clearResults();
  } catch (err) {
    showMessage(`Invalid JSON: ${err.message}`, 'error');
  }
});

function showRedirectUriHelp(redirectUrl) {
  const panel = document.getElementById('results');
  panel.innerHTML = '';

  const msg = document.createElement('div');
  msg.className = 'results-message error';
  msg.innerHTML =
    'Wrong credential type — need <strong>Web application</strong>.<br><br>' +
    'In Google Cloud Console: Credentials → Create → OAuth 2.0 → <strong>Web application</strong><br>' +
    'Add this redirect URI (click to copy):';
  panel.appendChild(msg);

  const box = document.createElement('div');
  box.className = 'redirect-uri-box';
  box.textContent = redirectUrl;
  box.title = 'Click to copy';
  box.addEventListener('click', () => {
    navigator.clipboard.writeText(redirectUrl);
    box.textContent = '✓ Copied!';
    setTimeout(() => (box.textContent = redirectUrl), 2000);
  });
  panel.appendChild(box);
}

// ─── Init ──────────────────────────────────────────────────────────────────────

// Restore configured state
chrome.runtime.sendMessage({ type: 'GET_CLIENT_ID' }, ({ clientId }) => {
  if (clientId) {
    configureBtn.textContent = '✓ Configured';
    configureBtn.classList.add('configured');
  }
});

// Show warning if Gmail isn't open
getGmailTab().then(tab => {
  if (!tab) {
    const results = document.getElementById('results');
    const msg = document.createElement('div');
    msg.className = 'not-gmail';
    msg.textContent = 'Open Gmail in a tab to use this extension.';
    results.appendChild(msg);
  }
});
