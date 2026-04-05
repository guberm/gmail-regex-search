// ─── Entry points ──────────────────────────────────────────────────────────────

function buildHomepageCard() {
  return buildSearchCard({});
}

function buildContextualCard(e) {
  const from = e?.gmail?.messageMetadata?.fromAddress || '';
  return buildSearchCard({ anyPattern: extractEmail(from) });
}

// ─── Card builders ─────────────────────────────────────────────────────────────

function buildSearchCard(state) {
  // ── Regex patterns section ──────────────────────────────────────────────────
  const patternSection = CardService.newCardSection()
    .setHeader('Regex Patterns')
    .addWidget(
      CardService.newTextInput()
        .setFieldName('subjectPattern')
        .setTitle('Subject')
        .setHint('e.g. invoice|receipt')
        .setValue(state.subjectPattern || '')
    )
    .addWidget(
      CardService.newTextInput()
        .setFieldName('bodyPattern')
        .setTitle('Body')
        .setHint('e.g. \\d{4}-\\d{4}')
        .setValue(state.bodyPattern || '')
    )
    .addWidget(
      CardService.newTextInput()
        .setFieldName('anyPattern')
        .setTitle('Any field')
        .setHint('subject, sender, or snippet')
        .setValue(state.anyPattern || '')
    );

  // ── Advanced / pre-filter section (collapsible) ────────────────────────────
  const advancedSection = CardService.newCardSection()
    .setHeader('Advanced')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0)
    .addWidget(
      CardService.newTextInput()
        .setFieldName('gmailQuery')
        .setTitle('Gmail pre-filter')
        .setHint('from:x@co.com  ·  after:2024/01/01  ·  subject:invoice')
        .setValue(state.gmailQuery || '')
    )
    .addWidget(
      CardService.newTextParagraph()
        .setText('<font color="#5f6368">Uses Gmail search syntax to narrow scope before applying regex. Leave blank to search all inbox.</font>')
    );

  // ── Action section ─────────────────────────────────────────────────────────
  const actionSection = CardService.newCardSection()
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('Search Inbox')
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            .setOnClickAction(CardService.newAction().setFunctionName('doSearch'))
        )
        .addButton(
          CardService.newTextButton()
            .setText('Clear')
            .setOnClickAction(CardService.newAction().setFunctionName('clearForm'))
        )
    );

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Gmail Regex Search')
        .setSubtitle('Regex-powered inbox search')
        .setImageUrl('https://www.gstatic.com/images/icons/material/system/2x/search_white_24dp.png')
        .setImageStyle(CardService.ImageStyle.CIRCLE)
    )
    .addSection(patternSection)
    .addSection(advancedSection)
    .addSection(actionSection)
    .build();
}

function buildResultsCard(results, scanned, timedOut, patterns) {
  const builder = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle(`${results.length} match${results.length === 1 ? '' : 'es'}`)
        .setSubtitle(`Scanned ${scanned} emails  ·  ${buildPatternSummary(patterns)}`)
        .setImageUrl('https://www.gstatic.com/images/icons/material/system/2x/search_white_24dp.png')
        .setImageStyle(CardService.ImageStyle.CIRCLE)
    );

  // Nav + optional timeout warning
  const navSection = CardService.newCardSection()
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('← New Search')
            .setOnClickAction(CardService.newAction().setFunctionName('goBack')
              .setParameters(patterns))
        )
    );

  if (timedOut) {
    navSection.addWidget(
      CardService.newTextParagraph()
        .setText('<font color="#e37400">⚠ Search hit the 25s time limit — results may be incomplete. Use a Gmail pre-filter to narrow scope.</font>')
    );
  }
  builder.addSection(navSection);

  if (results.length === 0) {
    builder.addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newDecoratedText()
            .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.INVITE))
            .setText('<font color="#5f6368">No messages matched your patterns.</font>')
        )
    );
  } else {
    for (const r of results) {
      builder.addSection(
        CardService.newCardSection()
          .addWidget(
            CardService.newDecoratedText()
              .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.EMAIL))
              .setTopLabel(`${r.from}  ·  ${r.date}`)
              .setText(`<b>${r.subject}</b>`)
              .setBottomLabel(r.snippet || '—')
              .setWrapText(true)
              .setOnClickAction(
                CardService.newAction()
                  .setFunctionName('openMessage')
                  .setParameters({ messageId: r.id })
              )
          )
      );
    }
  }

  return builder.build();
}

// ─── Action handlers ───────────────────────────────────────────────────────────

function doSearch(e) {
  const fi = e.commonEventObject.formInputs || {};
  const patterns = {
    gmailQuery:     fi.gmailQuery?.stringInputs?.value?.[0]     || '',
    subjectPattern: fi.subjectPattern?.stringInputs?.value?.[0] || '',
    bodyPattern:    fi.bodyPattern?.stringInputs?.value?.[0]    || '',
    anyPattern:     fi.anyPattern?.stringInputs?.value?.[0]     || '',
  };

  if (!patterns.subjectPattern && !patterns.bodyPattern && !patterns.anyPattern) {
    return notify('Enter at least one regex pattern.');
  }

  for (const [label, val] of [
    ['Subject',   patterns.subjectPattern],
    ['Body',      patterns.bodyPattern],
    ['Any field', patterns.anyPattern],
  ]) {
    if (!val) continue;
    try { new RegExp(val, 'i'); }
    catch (err) { return notify(`Invalid ${label} regex: ${err.message}`); }
  }

  let results, scanned, timedOut;
  try {
    ({ results, scanned, timedOut } = searchInbox(patterns));
  } catch (err) {
    return notify(`Search failed: ${err.message}`);
  }

  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().pushCard(buildResultsCard(results, scanned, timedOut, patterns))
    )
    .build();
}

function goBack(e) {
  const p = e.commonEventObject.parameters || {};
  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().pushCard(buildSearchCard({
        gmailQuery:     p.gmailQuery     || '',
        subjectPattern: p.subjectPattern || '',
        bodyPattern:    p.bodyPattern    || '',
        anyPattern:     p.anyPattern     || '',
      }))
    )
    .build();
}

function clearForm() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildSearchCard({})))
    .build();
}

function openMessage(e) {
  const messageId = e.commonEventObject.parameters?.messageId;
  if (!messageId) return notify('Could not open message.');
  return CardService.newActionResponseBuilder()
    .setOpenLink(CardService.newOpenLink()
      .setUrl(`https://mail.google.com/mail/u/0/#inbox/${messageId}`))
    .build();
}

// ─── Core search ───────────────────────────────────────────────────────────────

/**
 * Strategy: use Gmail's native query to pre-filter, then apply regex.
 * This makes "search all" practical — Gmail handles the heavy lifting.
 * Pagination walks every result from the query, no arbitrary cap.
 * Hard stop at 25 seconds to stay within Apps Script's 30s add-on limit.
 */
function searchInbox(patterns) {
  const token     = ScriptApp.getOAuthToken();
  const base      = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const fmt       = patterns.bodyPattern ? 'full' : 'metadata';
  const CHUNK     = 50;
  const DEADLINE  = Date.now() + 25000; // 25-second budget

  // Build Gmail query — default to inbox if no pre-filter provided
  const q = patterns.gmailQuery ? patterns.gmailQuery : 'in:inbox';

  const results = [];
  let scanned    = 0;
  let pageToken  = null;
  let timedOut   = false;

  outer: while (true) {
    // List up to 100 IDs per page
    let listUrl = `${base}/messages?maxResults=100&q=${encodeURIComponent(q)}`;
    if (pageToken) listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

    const listResp = UrlFetchApp.fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    });
    if (listResp.getResponseCode() !== 200) {
      throw new Error(`Gmail API ${listResp.getResponseCode()}: ${listResp.getContentText().substring(0, 200)}`);
    }

    const listData = JSON.parse(listResp.getContentText());
    const ids      = (listData.messages || []).map(m => m.id);
    if (ids.length === 0) break;

    // Fetch metadata in chunks of CHUNK with rate-limit pause
    for (let i = 0; i < ids.length; i += CHUNK) {
      if (Date.now() > DEADLINE) { timedOut = true; break outer; }
      if (i > 0) Utilities.sleep(300);

      const chunk = ids.slice(i, i + CHUNK);
      const reqs  = chunk.map(id => ({
        url: `${base}/messages/${id}?format=${fmt}`,
        headers: { Authorization: `Bearer ${token}` },
        muteHttpExceptions: true,
      }));

      const resps = UrlFetchApp.fetchAll(reqs);
      for (const r of resps) {
        if (r.getResponseCode() !== 200) continue;
        try {
          const m = JSON.parse(r.getContentText());
          if (!m || !m.id) continue;
          scanned++;
          const parsed = parseMessage(m);
          if (matchesPatterns(parsed, patterns)) results.push(parsed);
        } catch {}
      }
    }

    if (!listData.nextPageToken) break;
    pageToken = listData.nextPageToken;
    Utilities.sleep(200);
  }

  if (timedOut) {
    // Return what we have so far with a note
    results._timedOut = true;
  }

  return { results, scanned, timedOut };
}

function listMessageIds(token, base, maxResults) {
  const ids = [];
  let pageToken = null;

  while (ids.length < maxResults) {
    const batch = Math.min(100, maxResults - ids.length);
    let url = `${base}/messages?labelIds=INBOX&maxResults=${batch}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    });

    if (resp.getResponseCode() !== 200) {
      throw new Error(`Gmail API ${resp.getResponseCode()}: ${resp.getContentText().substring(0, 300)}`);
    }
    const data = JSON.parse(resp.getContentText());
    if (data.messages) ids.push(...data.messages.map(m => m.id));
    if (!data.nextPageToken || ids.length >= maxResults) break;
    pageToken = data.nextPageToken;
  }

  return ids.slice(0, maxResults);
}

function parseMessage(data) {
  const headers = {};
  for (const h of (data.payload?.headers || [])) {
    headers[h.name.toLowerCase()] = h.value;
  }
  return {
    id:      data.id,
    subject: headers['subject'] || '(no subject)',
    from:    parseFrom(headers['from'] || ''),
    date:    formatDate(headers['date'] || ''),
    snippet: truncate(decodeHtml(data.snippet || ''), 120),
    body:    extractBody(data.payload),
  };
}

function formatDate(raw) {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    const now = new Date();
    const isThisYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      year: isThisYear ? undefined : 'numeric',
    });
  } catch { return ''; }
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Utilities.newBlob(
      Utilities.base64Decode(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    ).getDataAsString();
  }
  for (const part of (payload.parts || [])) {
    const text = extractBody(part);
    if (text) return text;
  }
  return '';
}

function matchesPatterns(msg, patterns) {
  const { subjectPattern, bodyPattern, anyPattern } = patterns;
  try {
    if (subjectPattern && !new RegExp(subjectPattern, 'i').test(msg.subject)) return false;
    if (bodyPattern    && !new RegExp(bodyPattern,    'i').test(msg.body || msg.snippet)) return false;
    if (anyPattern     && !new RegExp(anyPattern,     'i').test(`${msg.from} ${msg.subject} ${msg.snippet}`)) return false;
  } catch { return false; }
  return true;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function truncate(str, max) {
  return str.length <= max ? str : str.substring(0, max).trimEnd() + '…';
}

function parseFrom(from) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<[^>]+>/, '').trim() || from;
}

function extractEmail(from) {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function buildPatternSummary(patterns) {
  const parts = [];
  if (patterns.gmailQuery)     parts.push(`q: ${patterns.gmailQuery}`);
  if (patterns.subjectPattern) parts.push(`subj: ${patterns.subjectPattern}`);
  if (patterns.bodyPattern)    parts.push(`body: ${patterns.bodyPattern}`);
  if (patterns.anyPattern)     parts.push(`any: ${patterns.anyPattern}`);
  return parts.join(' · ') || '';
}

function notify(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}

function testAuth() {
  const token = ScriptApp.getOAuthToken();
  const resp = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  Logger.log(resp.getContentText());
}
