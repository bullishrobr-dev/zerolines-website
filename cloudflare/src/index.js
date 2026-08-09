/**
 * Zero Lines — the whole site, on one Worker.
 *
 * Serves the 52 static pages from the ASSETS binding and owns the two things
 * Netlify Forms used to do: storing a submission and telling somebody about it.
 *
 * WHY THIS EXISTS
 *
 * The site was on Netlify's free plan with production deploys suspended, and
 * every deploy since was an upload-a-draft-then-promote-it manoeuvre that
 * stepped around a limit Netlify had deliberately set. That is not a thing to
 * keep doing quietly. Cloudflare's free tier permits commercial use outright —
 * which Vercel's Hobby plan does not — and the analyser Worker, the KV store
 * and the analytics were already here.
 *
 * The part that actually matters is smaller and duller: the waitlist stops
 * being a row in someone else's dashboard. Leads land in a D1 database in
 * Western Europe, on this account, exportable as CSV at any hour without
 * asking a vendor's permission.
 *
 * BINDINGS
 *   ASSETS      static site  (wrangler [assets] directory)
 *   ZL_LEADS    D1  — zl-leads, 16bb56f9-fbab-470c-a0d3-e6b94c10d8a4, WEUR
 *   RESEND_KEY  secret
 *   HOOK_SECRET secret — guards the CSV export
 *   ZL_NOTIFY   var — where submission alerts go (info@zerolines.life)
 */

import SCHEDULE_FILE from './schedule.json';

/* ---------------------------------------------------------------------------
   The publishing calendar.

   This site is static files. There is no CMS, no post database and no cron job,
   so "one article a week" is enforced by the only thing that moves on its own:
   the date. Every scheduled article ships in the bundle from day one and simply
   refuses to exist until its turn.

   Three things have to agree, or the effect leaks:
     · the article's own URL 404s while it is future-dated
     · /blog/ and the category hubs do not list it
     · sitemap.xml does not offer it to a crawler

   Miss the third and Google indexes a 404. Miss the second and a reader clicks
   a card into nothing.
   --------------------------------------------------------------------------- */
const SCHEDULE = (SCHEDULE_FILE && SCHEDULE_FILE.schedule) || {};

/* Whole days in UTC, so an article dated today is live from midnight rather
   than from whatever hour the deploy happened. */
function isPublished(slug, now) {
  const when = SCHEDULE[slug];
  if (!when) return true;                       // unlisted means published
  return when <= (now || new Date()).toISOString().slice(0, 10);
}

function slugFromPath(pathname) {
  const m = pathname.match(/^\/blog\/([a-z0-9-]+)\.html$/);
  return m ? m[1] : null;
}

/* One canonical spelling of every path, decided before anything routes on it.

   new URL().pathname leaves %2F encoded, so /blog%2Fslug.html arrived as the
   single segment "/blog%2Fslug.html" — which the publish gate's regex did not
   match, so it never fired — and then the assets binding decoded it and served
   the file. Every unpublished article was readable in full through that one
   substitution. Nothing linked to it and nothing would have found it, but a
   gate with a documented way around it is not a gate.

   It is a duplicate-content problem for the published pages too: the same
   article answering on two URLs is exactly what a canonical tag exists to
   prevent, and better not to create the second URL at all. */
function canonicalPath(pathname) {
  let p = pathname;
  for (let i = 0; i < 3; i++) {                 // %252F decodes to %2F decodes to /
    let next = p;
    try { next = decodeURIComponent(p); } catch (e) { break; }
    if (next === p) break;
    p = next;
  }
  p = p.replace(/\/{2,}/g, '/');                // collapse // and beyond
  const parts = [];
  for (const seg of p.split('/')) {             // resolve . and ..
    if (seg === '.' || seg === '') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return '/' + parts.join('/') + (p.endsWith('/') && parts.length ? '/' : '');
}

/* Hide anything the calendar has not reached yet.

   HTMLRewriter streams, so it cannot read a child and then remove the parent —
   by the time an <a href> is seen the opening tag has already gone out. So the
   date rides on the element that must disappear. [data-publish] rather than
   article[data-publish] because the same gate hides the backlinks the original
   twenty-five carry into articles that have not published: without it, adding
   old-to-new links would point a reader at a 404 for up to six months. */
function hideUnpublished(res) {
  if (!res || res.status !== 200) return res;
  const today = new Date().toISOString().slice(0, 10);
  return new HTMLRewriter()
    /* A link in running prose to an article that has not published yet.

       The [data-publish] handler below cannot do this job: it calls remove(),
       which on an inline anchor deletes the words along with the tag and leaves
       the sentence with a hole in it. removeAndKeepContent() drops the <a> and
       keeps the text, so the sentence still reads and simply is not a link yet.

       Matching on href rather than an attribute in the markup means this covers
       all 23 such links without touching 23 files, covers any written later,
       and needs no cleanup: the day the target publishes, the link becomes a
       link on its own. */
    .on('a[href]', {
      element(el) {
        const href = el.getAttribute('href') || '';
        const m = href.match(/^(?:https:\/\/zerolines\.life)?(?:\.\.)?\/?blog\/([a-z0-9-]+)\.html(?:[#?].*)?$/);
        if (!m) return;
        const when = SCHEDULE[m[1]];
        if (when && when > today) el.removeAndKeepContent();
      },
    })
    .on('[data-publish]', {
      element(el) {
        /* One calendar, not two. The element may carry a date, but schedule.json
           is the authority — a date copied into markup and a date in the
           manifest can drift, and a test proved they do: moving one article
           forward in the manifest opened its URL and its sitemap entry while
           its card stayed hidden, because the card was still trusting its own
           copy. data-slug lets the same lookup answer everywhere. */
        const slug = el.getAttribute('data-slug');
        const when = (slug && SCHEDULE[slug]) || el.getAttribute('data-publish');
        if (when && when > today) el.remove();
      },
    })
    .transform(res);
}

/* Offering a crawler a URL that answers 404 is the one way this scheme could
   cost rankings rather than merely delay them. */
async function filterSitemap(res) {
  if (!res || res.status !== 200) return res;
  const xml = await res.text();
  const today = new Date().toISOString().slice(0, 10);
  const kept = xml.replace(/[ \t]*<url>[\s\S]*?<\/url>\n?/g, (b) => {
    const loc = b.match(/<loc>([^<]+)<\/loc>/);
    if (!loc) return b;
    const m = loc[1].match(/\/blog\/([a-z0-9-]+)\.html$/);
    if (!m) return b;
    const when = SCHEDULE[m[1]];
    return (when && when > today) ? '' : b;
  });
  return new Response(kept, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

const FROM = 'Zero Lines <scan@zerolines.life>';
const REPLY_TO = 'info@zerolines.life';
const SITE = 'https://zerolines.life';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* A plain === on a shared secret leaks its prefix through timing. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* The raw IP is never written down. It is useful for spotting one address
   submitting forty times and useless afterwards, so it is salted with the
   hook secret and truncated — enough to compare two submissions, not enough
   to recover the address or to be personal data worth breaching. */
async function hashIp(ip, salt) {
  if (!ip) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + ip));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------------------------------------------------------------------
   The confirmation email. Same visual grammar as the assessment: table spine,
   inline styles, Georgia standing in for Cormorant, no webfonts and no images,
   because that is what mail clients render the same way twice.
   --------------------------------------------------------------------------- */
function buildWelcome(kind, unsubUrl) {
  const BONE = '#FAF7F2', INK = '#14181A', INK3 = '#3C4142';
  const HOUSE = '#1F4F4A', MID = '#17706D', CHAMP = '#C2A878';
  const p = (t, x) => `<p style="margin:0 0 14px;font:400 15px/1.75 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK3};${x || ''}">${t}</p>`;
  const h2 = (t) => `<h2 style="margin:30px 0 12px;font:300 21px/1.3 Georgia,serif;color:${INK}">${t}</h2>`;

  let subject, body = '', lines = [];

  if (kind === 'contact') {
    subject = 'We have your message';
    body += `<h1 style="margin:0 0 6px;font:300 30px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.4px">We have your message</h1>`
      + `<p style="margin:0 0 26px;font:500 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">Zero Lines &middot; Gibraltar &middot; Andorra &middot; Marbella</p>`
      + p('Thank you for writing. Your message has reached us and someone will read it and answer personally.', `font-size:16px;color:${INK};`)
      + p('We use what you sent only to reply to you. It does not join a mailing list, and this is the last automatic message you will get about it — the next one will be from a person.');
    lines = ['WE HAVE YOUR MESSAGE', '',
      'Thank you for writing. Your message has reached us and someone will read it and answer personally.', '',
      'We use what you sent only to reply to you. It does not join a mailing list.'];
  } else if (kind === 'newsletter') {
    /* A journal subscriber is not a waitlist registrant. Before this branch
       existed they got the waitlist letter — "when ordering opens you will hear
       from us before anyone else" — which answers a question they did not ask
       and says nothing about the writing they actually signed up for. */
    subject = 'The next one comes on Monday';
    body += `<h1 style="margin:0 0 6px;font:300 30px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.4px">The next one comes on Monday</h1>`
      + `<p style="margin:0 0 26px;font:500 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">Zero Lines &middot; Gibraltar &middot; Andorra &middot; Marbella</p>`
      + p('Thank you for subscribing. The journal publishes one piece a week, on Monday, and each one will arrive here as it goes out.', `font-size:16px;color:${INK};`)
      + p('It is written to be useful whether or not you ever buy anything from us — what holds up, what does not, and how to tell the difference. One a week, and no more than that.')
      + h2('While you wait')
      + p('The skin analysis is free and open now. One photograph and ten questions; a written assessment comes back to this address, read zone by zone, with a note on what a single photograph honestly cannot show.')
      + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:${HOUSE};padding:14px 26px">`
      + `<a href="${SITE}/analyser/" style="color:#fff;text-decoration:none;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase">Begin the free analysis</a>`
      + `</td></tr></table>`
      + p('It takes about two minutes and needs no account.', 'font-size:12px;color:#636764;margin-top:10px;');
    lines = ['THE NEXT ONE COMES ON MONDAY', '',
      'Thank you for subscribing. The journal publishes one piece a week, on Monday, and each one will arrive here as it goes out.', '',
      'It is written to be useful whether or not you ever buy anything from us — what holds up, what does not, and how to tell the difference.', '',
      'While you wait, the skin analysis is free and open now: ' + SITE + '/analyser/'];
  } else {
    subject = 'You are on the list';
    body += `<h1 style="margin:0 0 6px;font:300 30px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.4px">You are on the list</h1>`
      + `<p style="margin:0 0 26px;font:500 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">Zero Lines &middot; Gibraltar &middot; Andorra &middot; Marbella</p>`
      + p('Thank you for registering. When ordering opens you will hear from us before anyone else — that is the entire purpose of the list, and it is the only list we keep.', `font-size:16px;color:${INK};`)
      + p('We have not set a date, and we would rather say that plainly than guess at one.')
      + h2('You do not have to wait for us')
      + p('The skin analysis is free, open now, and does not depend on the launch. One photograph and ten questions; a written assessment comes back to this address — read zone by zone, with a note on what a single photograph honestly cannot show.')
      + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:${HOUSE};padding:14px 26px">`
      + `<a href="${SITE}/analyser/" style="color:#fff;text-decoration:none;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase">Begin the free analysis</a>`
      + `</td></tr></table>`
      + p('It takes about two minutes and needs no account.', 'font-size:12px;color:#636764;margin-top:10px;')
      + `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:2px solid ${CHAMP};margin:30px 0 0"><tr><td style="padding:18px 0 0">`
      + `<div style="font:500 11px/1.6 -apple-system,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">What we are building</div>`
      + p('Every Zero Lines formulation is made to do two things at once. There is an immediate effect, visible the same day. And there is a lasting one, which builds quietly over weeks of consistent use. Most of the industry sells the first and implies the second. We would rather tell you which is which.', 'margin-top:10px;')
      + `</td></tr></table>`;
    lines = ['YOU ARE ON THE LIST', '',
      'Thank you for registering. When ordering opens you will hear from us before anyone else — that is the entire purpose of the list, and it is the only list we keep.', '',
      'We have not set a date, and we would rather say that plainly than guess at one.', '',
      'The skin analysis is free and open now: ' + SITE + '/analyser/', '',
      'Every Zero Lines formulation is made to do two things at once — an immediate effect, visible the same day, and a lasting one that builds over weeks.'];
  }

  body += `<div style="border-top:1px solid #E2DCD2;margin-top:32px;padding-top:20px">`
    + p('The Zero Lines collection is in pre-launch and not yet available to purchase.', 'font-size:12px;color:#636764;')
    /* This used to read "reply to this message and we will take you off the
       list. No form, no link, no questions." Lawful, and pleasant, but the only
       machinery behind it was somebody remembering. Now it is a link. */
    + (kind === 'contact' || !unsubUrl ? '' : p(`If you would rather not hear from us again, <a href="${unsubUrl}" style="color:${MID}">unsubscribe here</a> — one click, no questions. Or simply reply and we will do it by hand.`, 'font-size:12px;color:#636764;'))
    + `</div>`;

  lines.push('', 'The Zero Lines collection is in pre-launch and not yet available to purchase.');
  if (kind !== 'contact') {
    lines.push(unsubUrl
      ? 'To stop hearing from us: ' + unsubUrl
      : 'If you would rather not hear from us again, reply and we will take you off the list.');
  }
  lines.push('', 'zerolines.life');

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${BONE}">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BONE}"><tr><td align="center" style="padding:32px 16px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;padding:36px 34px">`
    + `<tr><td><div style="font:500 15px/1 -apple-system,sans-serif;letter-spacing:5px;text-transform:uppercase;color:${INK};padding-bottom:28px">Zero Lines</div>${body}</td></tr>`
    + `</table>`
    + `<div style="font:400 12px/1.7 -apple-system,sans-serif;color:#636764;padding-top:18px;max-width:600px">Zero Lines &middot; Gibraltar &middot; Andorra &middot; Marbella &middot; <a href="${SITE}" style="color:${MID}">zerolines.life</a></div>`
    + `</td></tr></table></body></html>`;

  return { subject, html, text: lines.join('\n') };
}

/* ---------------------------------------------------------------------------
   Unsubscribe.

   handleExport() has always filtered `WHERE unsubscribed = 0`, but nothing ever
   wrote that column — the filter was decoration over a value that was 0 on
   every row and always would be. The only opt-out actually offered was "reply
   and we will take you off the list", which is lawful but has no mechanism
   behind it beyond somebody remembering.

   The token is an HMAC of the address under the hook secret. No table of
   tokens has to exist, and every address ever collected already has a valid
   link without a backfill. The address itself travels in the URL: it is the
   recipient's own address, in a link sent to their own inbox, which is how
   every mailing list on the internet does this. The page sets Referrer-Policy
   no-referrer and loads nothing from any other host, so it goes no further.

   GET does not unsubscribe anybody. Corporate mail scanners and link
   previewers fetch every URL in a message, so a GET that mutates would quietly
   remove people who never clicked. GET shows a button; POST does the work.
   One-click (RFC 8058) arrives as a POST, so it still works without a visit.
   --------------------------------------------------------------------------- */
async function unsubToken(email, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret || 'zl'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('unsub:' + email));
  return [...new Uint8Array(sig)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function unsubLink(email, env) {
  return `${SITE}/unsubscribe?e=${encodeURIComponent(email)}&t=${await unsubToken(email, env.HOOK_SECRET)}`;
}

function unsubPage(heading, body, form) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex,nofollow">`
    + `<title>${esc(heading)} &mdash; Zero Lines</title>`
    + `<link rel="stylesheet" href="/assets/zl.css"></head>`
    + `<body style="background:#FAF7F2;margin:0">`
    + `<main style="max-width:34rem;margin:0 auto;padding:5rem 1.5rem;font:400 16px/1.75 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#3C4142">`
    + `<div style="font:500 15px/1 -apple-system,sans-serif;letter-spacing:5px;text-transform:uppercase;color:#14181A;padding-bottom:2rem">Zero Lines</div>`
    + `<h1 style="font:300 30px/1.25 Georgia,'Times New Roman',serif;color:#14181A;margin:0 0 1rem;letter-spacing:-.4px">${esc(heading)}</h1>`
    + body + (form || '')
    + `<p style="margin-top:3rem;font-size:13px;color:#636764"><a href="${SITE}/" style="color:#17706D">zerolines.life</a></p>`
    + `</main></body></html>`;
}

async function handleUnsubscribe(request, env, url) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
  };
  const email = String(url.searchParams.get('e') || '').trim().toLowerCase();
  const token = String(url.searchParams.get('t') || '').trim();
  const valid = EMAIL_RE.test(email) && email.length <= 254
    && safeEqual(token, await unsubToken(email, env.HOOK_SECRET));

  if (!valid) {
    return new Response(unsubPage('That link is not complete',
      `<p>The link did not carry everything it needed &mdash; some mail clients break a long one across lines. Write to <a href="mailto:${REPLY_TO}" style="color:#17706D">${REPLY_TO}</a> and we will take you off by hand, the same day.</p>`),
      { status: 400, headers });
  }

  if (request.method === 'POST') {
    try {
      await env.ZL_LEADS.prepare('UPDATE leads SET unsubscribed = 1 WHERE email = ?').bind(email).run();
    } catch (e) {
      return new Response(unsubPage('That did not save',
        `<p>Something went wrong at our end and you are still on the list. Write to <a href="mailto:${REPLY_TO}" style="color:#17706D">${REPLY_TO}</a> and we will do it by hand.</p>`),
        { status: 500, headers });
    }
    return new Response(unsubPage('You are off the list',
      `<p><strong>${esc(email)}</strong> will not hear from us again. There is nothing else to do.</p>`
      + `<p style="font-size:14px;color:#636764">If that was an accident, you can join again from any page on the site.</p>`),
      { status: 200, headers });
  }

  return new Response(unsubPage('Unsubscribe',
    `<p>This takes <strong>${esc(email)}</strong> off the Zero Lines list for good.</p>`,
    `<form method="POST" action="/unsubscribe?e=${encodeURIComponent(email)}&amp;t=${esc(token)}" style="margin-top:1.75rem">`
    + `<button type="submit" style="background:#1F4F4A;color:#fff;border:0;padding:15px 28px;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase;cursor:pointer">Unsubscribe</button>`
    + `</form>`
    + `<p style="margin-top:1.5rem;font-size:14px;color:#636764">We ask you to confirm because mail scanners follow links on their own, and we would rather not remove somebody who never clicked one.</p>`),
    { status: 200, headers });
}

async function sendMail(env, to, subject, html, text, replyTo, unsubUrl) {
  const payload = { from: FROM, to: [to], reply_to: replyTo || REPLY_TO, subject, html, text };
  /* RFC 8058. With these present, Gmail and Outlook show their own unsubscribe
     control at the top of the message, and a reader who uses it is not filing a
     spam complaint — which is the difference that keeps a sending domain
     healthy. List mail only: a reply to somebody's enquiry is not a list. */
  if (unsubUrl) {
    payload.headers = {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.ok;
}

/* The alert to the house. Netlify sent one of these and it is the only reason
   anyone knew a submission had happened at all — for two days in August it was
   switched off, and a real person joined the list unnoticed. */
function buildNotice(row) {
  const rows = [
    ['Form', row.form], ['Email', row.email], ['Name', row.name],
    ['Message', row.message], ['Source', row.source], ['Referrer', row.referrer],
    ['Country', row.country], ['When', row.created_at],
  ].filter(([, v]) => v);
  /* The preheader — the grey line a phone shows under the subject. Without one,
     mail clients build it by flattening whatever HTML comes first, and a table
     flattens into "FormcontactEmailbullishrobr@gmail." That is the line Roberto
     reads once per lead, forever, so it carries the thing worth knowing at a
     glance: what a contact actually wrote, or where a signup came from. */
  const preheader = row.form === 'contact'
    ? (row.message || 'No message text.').replace(/\s+/g, ' ').slice(0, 110)
    : ['from ' + (row.source || 'an unknown page'), row.country, row.referrer && row.referrer.replace(/^https?:\/\/[^/]+/, '') || null]
        .filter(Boolean).join(' · ').slice(0, 110);

  const html = `<div style="font:400 15px/1.7 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#14181A">`
    // Hidden, then padded so the real content cannot leak into the snippet.
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}`
    + '&#8199;&#65279;'.repeat(60) + `</div>`
    + `<p style="font-size:17px;margin:0 0 16px"><strong>${esc(row.form)}</strong> — ${esc(row.email)}</p>`
    + `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">`
    + rows.map(([k, v]) => `<tr><td style="padding:5px 18px 5px 0;color:#636764;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:5px 0">${esc(v)}</td></tr>`).join('')
    + `</table></div>`;
  return {
    subject: `${row.form === 'contact' ? 'Message' : 'Waitlist'}: ${row.email}`,
    html,
    text: preheader + '\n\n' + rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
  };
}

/* Record what a send actually did. Fire-and-forget by design: if this UPDATE
   fails the lead is still safely stored, and a wrong flag is worth less than a
   500 to someone who just handed over their address. */
async function mark(env, rowId, column, ok) {
  if (!rowId || !ok) return;
  try {
    await env.ZL_LEADS.prepare(`UPDATE leads SET ${column} = 1 WHERE id = ?`).bind(rowId).run();
  } catch (e) { /* the row matters; the flag is bookkeeping */ }
}

async function handleForm(request, env, ctx) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return new Response('{"error":"Method not allowed"}', { status: 405, headers: cors });

  const ct = request.headers.get('content-type') || '';
  let f;
  try {
    f = ct.includes('application/json')
      ? new Map(Object.entries(await request.json()))
      : new URLSearchParams(await request.text());
  } catch (e) {
    return new Response('{"error":"Could not read the submission."}', { status: 400, headers: cors });
  }
  const get = (k) => String((f.get ? f.get(k) : '') || '').trim();

  /* The honeypot. A field no human sees and every naive bot fills in. Answer
     200 rather than an error — a bot told it failed simply tries again. */
  if (get('bot-field')) return new Response('{"ok":true}', { status: 200, headers: cors });

  const form = (get('form-name') || get('form') || 'waitlist').toLowerCase();
  if (!['waitlist', 'contact', 'newsletter'].includes(form)) {
    return new Response('{"error":"Unknown form."}', { status: 400, headers: cors });
  }
  const email = get('email').toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return new Response('{"error":"That email address does not look complete."}', { status: 400, headers: cors });
  }

  const row = {
    created_at: new Date().toISOString(),
    form,
    email,
    name: get('name').slice(0, 200) || null,
    message: get('message').slice(0, 5000) || null,
    source: get('source').slice(0, 60) || null,
    referrer: (request.headers.get('referer') || '').slice(0, 300) || null,
    country: request.headers.get('CF-IPCountry') || null,
    ua: (request.headers.get('user-agent') || '').slice(0, 300) || null,
    ip_hash: await hashIp(request.headers.get('CF-Connecting-IP'), env.HOOK_SECRET || 'zl'),
  };

  /* Every submission is kept. An earlier draft deduped on (form, email, day)
     and immediately swallowed a real event: one visitor joined from the
     homepage at 11:32 and finished the analyser at 11:39, and the second row
     vanished. Those are two different things a person did, and the record of
     which pages convert is the whole reason to hold this data at all.
     Duplicate *emails* are prevented separately, below, where the problem
     actually is. */
  /* ---- rate limit ------------------------------------------------------
     Anybody who knows this address can post to it as fast as they like, and
     two things follow. The lead table is the only asset this business has, and
     it can be filled with rubbish — which matters far more at six real rows
     than it would at six thousand. Worse, a Zero Lines-branded welcome goes to
     whatever address is posted, so without a limit this endpoint will mail
     strangers on request, which is how a sending domain gets blocklisted.

     Counted against the salted ip_hash already on every row, so it needs no
     new storage and no dashboard rule. Someone rotating addresses gets past
     it; that is not what this is for. It stops the flood and it caps how much
     mail one source can make us send. */
  const RATE_MAX = 5;
  const RATE_WINDOW_MIN = 15;
  if (row.ip_hash) {
    try {
      const since = new Date(Date.now() - RATE_WINDOW_MIN * 60000).toISOString();
      const recent = await env.ZL_LEADS.prepare(
        `SELECT COUNT(*) AS n FROM leads WHERE ip_hash = ? AND created_at > ?`
      ).bind(row.ip_hash, since).first();
      if (recent && recent.n >= RATE_MAX) {
        return new Response('{"error":"That is a lot of submissions in a short time. Please wait a few minutes."}',
          { status: 429, headers: cors });
      }
    } catch (e) { /* the limiter must never be the reason a real lead is lost */ }
  }

  let firstTime, ins;
  try {
    firstTime = await env.ZL_LEADS.prepare(
      `SELECT COUNT(*) AS n FROM leads WHERE email = ? AND form = ? AND emailed = 1`
    ).bind(email, form).first();
    /* emailed starts at 0. It used to be written as 1 in the same statement
       that creates the row, while the SELECT above reads that column to decide
       whether this person has already been welcomed — and sendMail's success
       boolean was thrown away by waitUntil. So a Resend outage marked someone
       as welcomed forever: they had heard nothing, and nothing would ever try
       again. The flag now records what actually happened. */
    ins = await env.ZL_LEADS.prepare(
      `INSERT INTO leads (created_at, form, email, name, message, source, referrer, country, ua, ip_hash, emailed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(row.created_at, row.form, row.email, row.name, row.message, row.source,
           row.referrer, row.country, row.ua, row.ip_hash).run();
  } catch (e) {
    return new Response('{"error":"Could not record that. Please try again."}', { status: 500, headers: cors });
  }
  const rowId = ins && ins.meta && ins.meta.last_row_id;
  const alreadyWelcomed = !!(firstTime && firstTime.n > 0);

  /* The unsubscribe page promises, in those words, that they will not hear
     from us again. So a later submission of that same address sends nothing —
     the row is still recorded, because Roberto should be able to see it, but
     no mail goes out. This does mean a genuine change of mind has to be
     handled by a human, which is the right way round: the alternative lets
     anybody put a stranger back on the list by typing their address. */
  let optedOut = false;
  try {
    const u = await env.ZL_LEADS.prepare(
      `SELECT MAX(unsubscribed) AS u FROM leads WHERE email = ?`
    ).bind(email).first();
    optedOut = !!(u && u.u);
  } catch (e) { /* if we cannot tell, fall through to the normal rules */ }

  if (env.RESEND_KEY) {
    // The alert always fires. Roberto wants to know about the second visit too.
    const notice = buildNotice(row);
    ctx.waitUntil(
      sendMail(env, env.ZL_NOTIFY || REPLY_TO, notice.subject, notice.html, notice.text, email)
        .then((ok) => mark(env, rowId, 'notified', ok))
    );

    /* Two reasons to stay quiet. Someone who has written to us before does not
       need welcoming twice; and the analyser records its own leads here, having
       just sent that person a full written assessment — inviting them to go and
       take the analysis would be the house not paying attention. */
    if (!alreadyWelcomed && !optedOut && row.source !== 'analyser' && row.source !== 'analyser-started') {
      const kind = form === 'contact' ? 'contact' : form === 'newsletter' ? 'newsletter' : 'waitlist';
      // A reply to an enquiry is not list mail, so it carries no unsubscribe.
      const unsub = kind === 'contact' ? '' : await unsubLink(email, env);
      const w = buildWelcome(kind, unsub);
      ctx.waitUntil(sendMail(env, email, w.subject, w.html, w.text, undefined, unsub).then((ok) => mark(env, rowId, 'emailed', ok)));
    } else {
      // Nothing to send, so nothing is owed. Recording it as handled keeps the
      // "have they been welcomed" question answerable from one column.
      ctx.waitUntil(mark(env, rowId, 'emailed', true));
    }
  }
  const inserted = true;

  /* Without JavaScript the browser posted a real form and is waiting for a
     page. With it, zl.js reads the JSON and never navigates. */
  if ((request.headers.get('accept') || '').includes('text/html')) {
    return Response.redirect(SITE + '/thank-you/', 303);
  }
  return new Response(JSON.stringify({ ok: true, recorded: inserted }), { status: 200, headers: cors });
}

/* The list, as a file, on demand. Netlify owned this view; now it is a URL the
   house holds the key to. */
async function handleExport(url, env) {
  if (!env.HOOK_SECRET || !safeEqual(url.searchParams.get('k') || '', env.HOOK_SECRET)) {
    return new Response('Not found.', { status: 404 });
  }
  const { results } = await env.ZL_LEADS.prepare(
    `SELECT created_at, form, email, name, message, source, referrer, country
       FROM leads WHERE unsubscribed = 0 ORDER BY created_at DESC`
  ).all();
  const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = ['created_at,form,email,name,message,source,referrer,country']
    .concat((results || []).map((r) => [r.created_at, r.form, r.email, r.name, r.message, r.source, r.referrer, r.country].map(cell).join(',')))
    .join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="zero-lines-leads.csv"',
      'Cache-Control': 'no-store',
    },
  });
}

/* Static routing, done here rather than by the assets binding.
 *
 * The site is two shapes at once: /products/ and /story/ are directory indexes,
 * while /faq.html and all twenty-five journal articles are real .html files.
 * Cloudflare's "auto-trailing-slash" mode serves the first shape and answers
 * the second with a 307 to an extensionless twin — measured at nine of the
 * twenty-seven routes tested, all of them already indexed by Google at the
 * address it was redirecting away from.
 *
 * So: ask for exactly what the visitor asked for, and only if that misses, try
 * the directory index. No redirect, no URL change, nothing for a crawler to
 * re-learn.
 */
async function serveAsset(request, env, url) {
  /* The clean request matters as much as the path.
   *
   * A browser sends `sec-fetch-mode: navigate` on every page load, and under
   * that header the assets binding answers any path without an exact file
   * match with the 404 page — so /index.html and /faq.html were fine while /
   * and /products/ were not. Every curl test passed because curl sends no such
   * header; the entire site 404'd in a real browser. Copying the incoming
   * request into the fallback carried the header along and hit the same rule.
   *
   * So the binding is only ever asked for an exact file, by a plain GET. */
  const ask = (pathname) =>
    env.ASSETS.fetch(new Request(new URL(pathname + url.search, url), { method: 'GET' }));

  const p = url.pathname;

  /* Exact path first. This is also what applies _redirects — the ten legacy
     short URLs (/faq, /journal, /analyzer) live there, and with the Worker now
     running ahead of the assets binding, skipping straight to an index file
     would step over every one of them. */
  const direct = await ask(p);
  if (direct.status !== 404) return direct;

  // Directory-style URL: resolve its index. /faq.html and /assets/zl.css have
  // extensions and are genuinely missing if the exact ask failed.
  if (!/\.[a-z0-9]{2,5}$/i.test(p)) {
    const viaIndex = await ask(p.endsWith('/') ? p + 'index.html' : p + '/index.html');
    if (viaIndex.status !== 404) return viaIndex;
  }

  // Genuinely missing. Serve the house's own 404 page, with a 404 status.
  const notFound = await ask('/404.html');
  return new Response(notFound.body, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* Eight of the ten rules in _redirects point at a file and the assets binding
   resolves them itself. Two point at a directory — /journal -> /blog/ and
   /analyzer -> /analyser/ — and there the binding follows the rule, looks for
   a file at the directory path, finds none, and answers 404. Both are old
   addresses that may be in somebody's bookmarks, so they get a real redirect
   here, before the binding is consulted at all. */
/* Short URLs, answered with a real 301.

   These used to live only in _redirects, and that file does work — but not the
   way it looks. The assets binding FOLLOWS its own redirect internally and
   hands back the destination's content with a 200, so /shipping served the
   shipping page while the address bar still said /shipping. Every one of these
   was therefore live at two URLs at once: exactly the duplicate content the
   %2F fix was about, arriving by a different door.

   It also broke outright for the two renamed product pages, because their
   destinations are directories and html_handling is "none" — the binding does
   not resolve a directory to its index.html, so the internal follow found
   nothing and returned the 404 page. /products/syringe/ answered 404 rather
   than pointing at its new home.

   Issuing the 301 here fixes both: the visitor's address bar updates, and a
   crawler is told plainly that the old URL has moved, which is the only way
   the old page's standing transfers to the new one.

   Keys carry no trailing slash — the lookup strips it, so one entry covers
   /products/syringe and /products/syringe/ alike. */
const LEGACY_DIR = {
  '/journal': '/blog/',
  '/analyser': '/analyser/',
  '/analyzer': '/analyser/',
  '/faq': '/faq.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
  '/cookies': '/cookies.html',
  '/accessibility': '/accessibility.html',
  '/shipping': '/shipping-returns.html',
  '/shipping-returns': '/shipping-returns.html',
  '/products/syringe': '/products/line-corrector/',
  '/products/syringe-refill': '/products/line-corrector-refill/',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/__forms') return handleForm(request, env, ctx);
    if (url.pathname === '/__forms/export') return handleExport(url, env);
    if (url.pathname === '/unsubscribe') return handleUnsubscribe(request, env, url);

    /* www and the apex are both attached to this Worker, so without this the
       whole site answers on two hostnames — Netlify used to 301 one to the
       other. Every canonical tag points at the apex, so this only makes the
       redirect explicit rather than leaving it to a crawler's judgement. */
    if (url.hostname === 'www.zerolines.life') {
      url.hostname = 'zerolines.life';
      return Response.redirect(url.toString(), 301);
    }

    /* Compare the destination against the RAW path, not the stripped one.
       '/analyser' -> '/analyser/' is a legitimate entry: the extensionless form
       should redirect to the real directory. But the lookup strips a trailing
       slash, so '/analyser/' found its own key and redirected to itself,
       forever. The analyser — the one page on this site whose entire job is
       collecting an address — answered nothing but a redirect loop. Redirect
       only when the destination actually differs from what was asked for. */
    const asked = url.pathname;
    const legacy = LEGACY_DIR[asked.replace(/\/+$/, '') || '/'];
    if (legacy && legacy !== asked) return Response.redirect(new URL(legacy, url).toString(), 301);

    /* Normalise first, and send anything that was not already canonical to the
       canonical form. This closes the %2F bypass and stops the same page
       answering on more than one URL. */
    const canon = canonicalPath(url.pathname);
    if (canon !== url.pathname) {
      const to = new URL(url);
      to.pathname = canon;
      /* Assigning .pathname re-encodes, so a path whose canonical form still
         needs encoding — a literal space, an accent — renders straight back to
         the URL we were handed, and redirecting there is an infinite loop.
         /blog%202/x.html did exactly that: 301 to itself, forever. Only
         redirect when the target genuinely differs; otherwise fall through and
         let the gate below judge the canonical path anyway. */
      if (to.pathname !== url.pathname) return Response.redirect(to.toString(), 301);
    }

    // A scheduled article does not exist until its date.
    const slug = slugFromPath(canon);
    if (slug && !isPublished(slug)) {
      const nf = await env.ASSETS.fetch(new Request(new URL('/404.html', url), { method: 'GET' }));
      return new Response(nf.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/sitemap.xml') return filterSitemap(await serveAsset(request, env, url));

    // Every HTML page, because backlinks to unpublished articles can appear on
    // any of them — not just the listings.
    const res = await serveAsset(request, env, url);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('text/html') ? hideUnpublished(res) : res;
  },
};
