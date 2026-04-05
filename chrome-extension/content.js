// Stores the last-applied patterns so the MutationObserver can re-apply on new emails
let currentPatterns = { subjectStr: '', bodyStr: '', anyStr: '' };

function applyRegexFilter(patterns) {
  const { subjectStr, bodyStr, anyStr } = patterns;
  const emailRows = document.querySelectorAll('tr[role="row"]');

  if (!subjectStr && !bodyStr && !anyStr) {
    emailRows.forEach(row => (row.style.display = ''));
    return 0;
  }

  let subjectRegex, bodyRegex, anyRegex;
  if (subjectStr) subjectRegex = new RegExp(subjectStr, 'i');
  if (bodyStr) bodyRegex = new RegExp(bodyStr, 'i');
  if (anyStr) anyRegex = new RegExp(anyStr, 'i');

  let matchCount = 0;
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

  return matchCount;
}

function clearFilter() {
  document.querySelectorAll('tr[role="row"]').forEach(row => (row.style.display = ''));
}

// ─── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'APPLY_FILTER') {
    currentPatterns = message.patterns;
    try {
      const matchCount = applyRegexFilter(message.patterns);
      sendResponse({ success: true, matchCount });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return false;
  }

  if (message.type === 'CLEAR_FILTER') {
    currentPatterns = { subjectStr: '', bodyStr: '', anyStr: '' };
    clearFilter();
    sendResponse({ success: true });
    return false;
  }
});

// ─── Re-apply filter when Gmail lazy-loads new emails ─────────────────────────

const observer = new MutationObserver(() => {
  const { subjectStr, bodyStr, anyStr } = currentPatterns;
  if (subjectStr || bodyStr || anyStr) {
    clearTimeout(window._regexFilterTimeout);
    window._regexFilterTimeout = setTimeout(() => {
      try { applyRegexFilter(currentPatterns); } catch {}
    }, 300);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
