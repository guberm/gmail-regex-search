// ─── UI ────────────────────────────────────────────────────────────────────────

function createUI() {
  const container = document.createElement('div');
  container.id = 'gmail-regex-container';

  container.innerHTML = `
    <div class="gmail-regex-header">
      Regex Search
      <span id="gmail-regex-status"></span>
    </div>
    <div class="gmail-regex-header-actions">
      <span class="gmail-regex-clear" id="regex-clear">Clear</span>
    </div>
    <input type="file" id="regex-creds-input" accept=".json" style="display:none">
    <div class="gmail-regex-inputs">
      <div><label>Subject:</label><input type="text" id="regex-subject" placeholder="e.g. ^Alert"></div>
      <div><label>Snippet:</label><input type="text" id="regex-body" placeholder="e.g. error\\d+"></div>
      <div><label>Anywhere:</label><input type="text" id="regex-any" placeholder="e.g. \\[Polymarket"></div>
    </div>
    <div class="gmail-regex-actions">
      <button id="regex-search-inbox-btn">Search All Inbox</button>
      <button id="regex-configure" class="gmail-regex-configure-btn" title="Upload Google API credentials JSON">Upload credentials.json</button>
    </div>
    <div id="regex-results" class="gmail-regex-results"></div>
  `;

  document.body.appendChild(container);

  document.getElementById('regex-subject').addEventListener('input', applyRegexFilter);
  document.getElementById('regex-body').addEventListener('input', applyRegexFilter);
  document.getElementById('regex-any').addEventListener('input', applyRegexFilter);

  document.getElementById('regex-clear').addEventListener('click', () => {
    document.getElementById('regex-subject').value = '';
    document.getElementById('regex-body').value = '';
    document.getElementById('regex-any').value = '';
    hideResults();
    applyRegexFilter();
  });

  document.getElementById('regex-search-inbox-btn').addEventListener('click', searchAllInbox);

  // Configure button opens file picker
  document.getElementById('regex-configure').addEventListener('click', () => {
    document.getElementById('regex-creds-input').click();
  });

  document.getElementById('regex-creds-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // reset so same file can be re-uploaded
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const credType = Object.keys(json)[0]; // 'web', 'installed', etc.
      const clientId = json.web?.client_id || json.installed?.client_id || json.client_id;
      if (!clientId) {
        showResultsMessage('Could not find client_id in that file.', 'error');
        return;
      }
      if (credType !== 'web') {
        const { redirectUrl } = await chrome.runtime.sendMessage({ type: 'GET_REDIRECT_URL' });
        showCredentialTypeError(redirectUrl);
        return;
      }
      await chrome.runtime.sendMessage({ type: 'SAVE_CLIENT_ID', clientId });
      const btn = document.getElementById('regex-configure');
      btn.textContent = '✓ Configured';
      btn.classList.add('gmail-regex-configure-btn--done');
    } catch (err) {
      showResultsMessage(`Invalid JSON: ${err.message}`, 'error');
    }
  });

  // Show configured state if client_id already saved
  chrome.runtime.sendMessage({ type: 'GET_CLIENT_ID' }, ({ clientId }) => {
    if (clientId) {
      const btn = document.getElementById('regex-configure');
      btn.textContent = '✓ Configured';
      btn.classList.add('gmail-regex-configure-btn--done');
    }
  });
}

// ─── Visible filter ────────────────────────────────────────────────────────────

function getPatterns() {
  return {
    subjectStr: document.getElementById('regex-subject').value,
    bodyStr: document.getElementById('regex-body').value,
    anyStr: document.getElementById('regex-any').value,
  };
}

function applyRegexFilter() {
  const { subjectStr, bodyStr, anyStr } = getPatterns();
  const status = document.getElementById('gmail-regex-status');
  const emailRows = document.querySelectorAll('tr[role="row"]');

  if (!subjectStr && !bodyStr && !anyStr) {
    emailRows.forEach(row => (row.style.display = ''));
    status.innerText = '';
    return;
  }

  let subjectRegex, bodyRegex, anyRegex;
  try {
    if (subjectStr) subjectRegex = new RegExp(subjectStr, 'i');
    if (bodyStr) bodyRegex = new RegExp(bodyStr, 'i');
    if (anyStr) anyRegex = new RegExp(anyStr, 'i');
  } catch (e) {
    status.innerText = ' (invalid regex)';
    status.title = e.message;
    status.style.color = 'red';
    return;
  }

  let matchCount = 0;
  status.style.color = '';

  emailRows.forEach(row => {
    let matches = true;
    if (subjectRegex) {
      const el = row.querySelector('.bog');
      if (!subjectRegex.test(el ? el.textContent : '')) matches = false;
    }
    if (matches && bodyRegex) {
      const el = row.querySelector('.y2');
      if (!bodyRegex.test(el ? el.textContent : '')) matches = false;
    }
    if (matches && anyRegex) {
      if (!anyRegex.test(row.textContent)) matches = false;
    }

    row.style.display = matches ? '' : 'none';
    if (matches) matchCount++;
  });

  status.innerText = ` (${matchCount} visible)`;
  status.title = '';
}

// ─── Inbox search ──────────────────────────────────────────────────────────────

async function searchAllInbox() {
  const patterns = getPatterns();
  if (!patterns.subjectStr && !patterns.bodyStr && !patterns.anyStr) {
    showResultsMessage('Enter at least one regex pattern first.', 'info');
    return;
  }

  const btn = document.getElementById('regex-search-inbox-btn');
  btn.disabled = true;
  showResultsMessage('Searching inbox...', 'loading');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_INBOX',
      patterns,
      maxResults: 200,
    });

    if (response.success) {
      renderResults(response.results);
    } else {
      showResultsMessage(`Error: ${response.error}`, 'error');
    }
  } catch (e) {
    showResultsMessage(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

function renderResults(results) {
  const panel = document.getElementById('regex-results');
  panel.style.display = 'block';
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'regex-results-header';
  header.textContent = results.length === 0
    ? 'No matches found.'
    : `${results.length} match${results.length === 1 ? '' : 'es'} in inbox`;
  panel.appendChild(header);

  if (results.length === 0) return;

  const list = document.createElement('div');
  list.className = 'regex-results-list';

  for (const r of results) {
    const a = document.createElement('a');
    a.className = 'regex-result-item';
    a.href = `https://mail.google.com/mail/u/0/#inbox/${r.id}`;
    a.target = '_blank';

    const from = document.createElement('div');
    from.className = 'regex-result-from';
    from.textContent = r.from;

    const subject = document.createElement('div');
    subject.className = 'regex-result-subject';
    subject.textContent = r.subject;

    const snippet = document.createElement('div');
    snippet.className = 'regex-result-snippet';
    snippet.textContent = r.snippet;

    a.appendChild(from);
    a.appendChild(subject);
    a.appendChild(snippet);
    list.appendChild(a);
  }

  panel.appendChild(list);
}

function showResultsMessage(text, type = 'info') {
  const panel = document.getElementById('regex-results');
  panel.style.display = 'block';
  panel.innerHTML = '';

  const msg = document.createElement('div');
  msg.className = `regex-results-message regex-results-${type}`;
  msg.textContent = text;
  panel.appendChild(msg);
}

function hideResults() {
  const panel = document.getElementById('regex-results');
  panel.style.display = 'none';
  panel.innerHTML = '';
}

function showCredentialTypeError(redirectUrl) {
  const panel = document.getElementById('regex-results');
  panel.style.display = 'block';
  panel.innerHTML = '';

  const msg = document.createElement('div');
  msg.className = 'regex-results-message regex-results-error';
  msg.innerHTML = `Wrong credential type. You need a <strong>Web application</strong> OAuth client.<br><br>
    In Google Cloud Console:<br>
    1. Credentials → Create → OAuth 2.0 → <strong>Web application</strong><br>
    2. Add this redirect URI:<br>`;

  const uriBox = document.createElement('div');
  uriBox.className = 'regex-redirect-uri';
  uriBox.textContent = redirectUrl;
  uriBox.title = 'Click to copy';
  uriBox.addEventListener('click', () => {
    navigator.clipboard.writeText(redirectUrl);
    uriBox.textContent = '✓ Copied!';
    setTimeout(() => (uriBox.textContent = redirectUrl), 2000);
  });

  const note = document.createElement('div');
  note.style.marginTop = '6px';
  note.innerHTML = '3. Download JSON → upload here';

  panel.appendChild(msg);
  panel.appendChild(uriBox);
  panel.appendChild(note);
}

// ─── Init ──────────────────────────────────────────────────────────────────────

setTimeout(() => {
  if (!document.getElementById('gmail-regex-container')) {
    createUI();
  }
}, 3000);

const observer = new MutationObserver(() => {
  if (!document.getElementById('regex-subject')) return; // UI not ready yet
  const { subjectStr, bodyStr, anyStr } = getPatterns();
  if (subjectStr || bodyStr || anyStr) {
    clearTimeout(window.regexFilterTimeout);
    window.regexFilterTimeout = setTimeout(applyRegexFilter, 300);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
