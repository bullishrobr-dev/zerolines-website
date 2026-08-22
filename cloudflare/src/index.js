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
 *   ASSETS       static site  (wrangler [assets] directory)
 *   ZL_LEADS     D1  — zl-leads, 16bb56f9-fbab-470c-a0d3-e6b94c10d8a4, WEUR
 *   RESEND_KEY   secret
 *   HOOK_SECRET  secret — guards the export, the stats and the journal preview
 *   ZL_NOTIFY    var — where submission alerts go (info@zerolines.life)
 *   ZL_SEND_LIVE var — "yes" arms the Monday letter. Anything else, including
 *                absent, and the cron does a dry run. It ships "no". See MONDAY.
 *
 * WHAT ANSWERS WHERE
 *   /__forms           the four forms: waitlist, newsletter, contact, appointment
 *   /__forms/export    every lead, as CSV               ?k=HOOK_SECRET
 *   /__forms/stats     the same list counted, as JSON   ?k=HOOK_SECRET
 *   /__forms/journal   a dry run of the Monday letter   ?k=HOOK_SECRET
 *   /unsubscribe       GET asks, POST does it
 *   everything else    the static site, publish-gated
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
/* Turnstile, injected rather than written into the pages.

   Eighty-three files carry a form between them, and a site key pasted into all
   of them is eighty-three places to edit when it changes and eighty-three ways
   to have one page still posting without a challenge. It rides in from here
   instead, on the same stream that hides unpublished articles, and it appears
   the moment TURNSTILE_SITEKEY is set and vanishes if it is unset. Nothing to
   undo, and the forms keep working either way. */
function addChallenge(res, env) {
  if (!env.TURNSTILE_SITEKEY || !res || res.status !== 200) return res;   // '' reads as off
  const key = env.TURNSTILE_SITEKEY;
  return new HTMLRewriter()
    .on('head', {
      element(el) {
        el.append('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>', { html: true });
      },
    })
    /* Before the submit button rather than after the last field: Turnstile
       renders an empty div until it decides it needs to show something, and a
       stray gap above a button reads as spacing rather than as a fault. */
    .on('form[action="/__forms"]', {
      element(el) {
        el.append(`<div class="cf-turnstile" data-sitekey="${key}" data-theme="light" data-size="flexible"></div>`, { html: true });
      },
    })
    .transform(res);
}

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
   The parts every letter is made of. Same visual grammar as the assessment:
   table spine, inline styles, Georgia standing in for Cormorant, no webfonts
   and no images, because that is what mail clients render the same way twice.

   All of this used to be private to buildWelcome, which was right while there
   was one letter. There are two now — the welcome and the Monday journal letter
   below — and the second is only convincing as the same house's post if it is
   built from the same parts. Six hex values copied into a second function is
   how two letters start to drift, and nobody notices until they are read side
   by side in one inbox.
   --------------------------------------------------------------------------- */
const BONE = '#FAF7F2', INK = '#14181A', INK3 = '#3C4142';
const HOUSE = '#1F4F4A', MID = '#17706D', CHAMP = '#C2A878';
const HOUSES = 'Zero Lines &middot; Gibraltar &middot; Andorra &middot; Marbella';

const mailP = (t, x) => `<p style="margin:0 0 14px;font:400 15px/1.75 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK3};${x || ''}">${t}</p>`;
const mailH2 = (t) => `<h2 style="margin:30px 0 12px;font:300 21px/1.3 Georgia,serif;color:${INK}">${t}</h2>`;
const mailH1 = (t) => `<h1 style="margin:0 0 6px;font:300 30px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.4px">${t}</h1>`;
const mailEyebrow = (t) => `<p style="margin:0 0 26px;font:500 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">${t}</p>`;

/* The two lines every letter ends on: what the house is (pre-launch, nothing
   for sale) and how to stop hearing from it. Pass no URL and the second is
   omitted — a reply to somebody's enquiry is not list mail. */
function mailFoot(unsubUrl) {
  return `<div style="border-top:1px solid #E2DCD2;margin-top:32px;padding-top:20px">`
    + mailP('The Zero Lines collection is in pre-launch and not yet available to purchase.', 'font-size:12px;color:#636764;')
    /* This used to read "reply to this message and we will take you off the
       list. No form, no link, no questions." Lawful, and pleasant, but the only
       machinery behind it was somebody remembering. Now it is a link. */
    + (unsubUrl ? mailP(`If you would rather not hear from us again, <a href="${unsubUrl}" style="color:${MID}">unsubscribe here</a> — one click, no questions. Or simply reply and we will do it by hand.`, 'font-size:12px;color:#636764;') : '')
    + `</div>`;
}

/* Bone page, one 600px white card, the wordmark above the letter and the
   address line under it. */
function mailShell(body) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BONE}">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BONE}"><tr><td align="center" style="padding:32px 16px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;padding:36px 34px">`
    + `<tr><td><div style="font:500 15px/1 -apple-system,sans-serif;letter-spacing:5px;text-transform:uppercase;color:${INK};padding-bottom:28px">Zero Lines</div>${body}</td></tr>`
    + `</table>`
    + `<div style="font:400 12px/1.7 -apple-system,sans-serif;color:#636764;padding-top:18px;max-width:600px">Zero Lines &middot; Gibraltar &middot; Andorra &middot; Marbella &middot; <a href="${SITE}" style="color:${MID}">zerolines.life</a></div>`
    + `</td></tr></table></body></html>`;
}

/* ---------------------------------------------------------------------------
   The confirmation email.

   `piece` is the journal article the person was reading when they left their
   address, or null. handleForm has always stored a per-page `source` on every
   row and this letter has always ignored it, so somebody who subscribed at the
   foot of a two-thousand-word article got the same letter as somebody who
   typed their address into the homepage footer — a letter that gives no sign
   anyone noticed where they were. One paragraph now says so. Only one: the
   letter is the house's, not the article's, and a version per source is a
   maintenance problem pretending to be personalisation.

   `appt` is the house and the timing asked for, on the appointment branch
   only. That branch is not a welcome at all; see its own note below.
   --------------------------------------------------------------------------- */
function buildWelcome(kind, unsubUrl, piece, appt) {
  /* Named only when it is a journal article. The other fifty-odd sources are
     pages — /faq, /products/serum, the homepage — and "you subscribed from
     Frequently Asked Questions" is worse than saying nothing at all. */
  const named = !!(piece && piece.title);
  const fromPara = (verb) => named
    ? mailP(`You ${verb} from <a href="${piece.url}" style="color:${MID}">${esc(piece.title)}</a>. It stays where it is, should you want to finish it.`)
    : '';
  const fromLines = (verb) => named
    ? ['', `You ${verb} from ` + piece.title + ' — ' + piece.url]
    : [];

  let subject, body = '', lines = [];

  if (kind === 'contact') {
    subject = 'We have your message';
    body += mailH1('We have your message')
      + mailEyebrow(HOUSES)
      + mailP('Thank you for writing. Your message has reached us and someone will read it and answer personally.', `font-size:16px;color:${INK};`)
      + mailP('We use what you sent only to reply to you. It does not join a mailing list, and this is the last automatic message you will get about it — the next one will be from a person.');
    lines = ['WE HAVE YOUR MESSAGE', '',
      'Thank you for writing. Your message has reached us and someone will read it and answer personally.', '',
      'We use what you sent only to reply to you. It does not join a mailing list.'];
  } else if (kind === 'appointment') {
    /* A receipt, not a confirmation, and certainly not a welcome. Somebody who
       has asked to be let into a room deserves to know the request arrived —
       but nothing is booked until a person answers, and a letter that reads
       like a booking would be the house promising something it has not agreed
       to. So it says both, in that order, and repeats back what was asked for
       so that a wrong house or a wrong week can be spotted the same minute.
       No unsubscribe link: this is a reply to their own request, not list mail,
       and offering to remove them from a list they are not on would only
       suggest they had joined one. */
    const asked = [
      appt && appt.house ? `<strong style="color:${INK3}">House</strong>&nbsp; ${esc(appt.house)}` : null,
      appt && appt.timing ? `<strong style="color:${INK3}">When</strong>&nbsp; ${esc(appt.timing)}` : null,
    ].filter(Boolean);
    subject = 'We have your request to visit';
    body += mailH1('We have your request')
      + mailEyebrow(HOUSES)
      + mailP('Thank you. It has reached the house, and someone will write back personally to settle a time. Nothing is booked yet — this is a note to say the request arrived, not a confirmation.', `font-size:16px;color:${INK};`)
      + (asked.length
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:2px solid ${CHAMP};margin:26px 0"><tr><td style="padding:16px 0 0">`
          + mailP(asked.join('<br>'), 'margin-bottom:0;')
          + `</td></tr></table>`
        : '')
      + mailP('The houses are consultation rooms rather than shops. The collection is in pre-launch, so nothing is sold in them yet; a visit is a conversation about your skin and what would follow from it.')
      + mailP('We use what you sent only to arrange this. It does not join a mailing list.');
    lines = ['WE HAVE YOUR REQUEST', '',
      'Thank you. It has reached the house, and someone will write back personally to settle a time. Nothing is booked yet — this is a note to say the request arrived, not a confirmation.', '']
      .concat(appt && appt.house ? ['House: ' + appt.house] : [],
        appt && appt.timing ? ['When: ' + appt.timing] : [], ['',
        'The houses are consultation rooms rather than shops. The collection is in pre-launch, so nothing is sold in them yet.', '',
        'We use what you sent only to arrange this. It does not join a mailing list.']);
  } else if (kind === 'newsletter') {
    /* A journal subscriber is not a waitlist registrant. Before this branch
       existed they got the waitlist letter — "when ordering opens you will hear
       from us before anyone else" — which answers a question they did not ask
       and says nothing about the writing they actually signed up for. */
    subject = 'The next one comes on Monday';
    body += mailH1('The next one comes on Monday')
      + mailEyebrow(HOUSES)
      + mailP('Thank you for subscribing. The journal publishes one piece a week, on Monday, and each one will arrive here as it goes out.', `font-size:16px;color:${INK};`)
      + fromPara('subscribed')
      + mailP('It is written to be useful whether or not you ever buy anything from us — what holds up, what does not, and how to tell the difference. One a week, and no more than that.')
      + mailH2('While you wait')
      + mailP('The skin analysis is free and open now. One photograph and sixteen questions; a written assessment comes back to this address, read zone by zone, with a note on what a single photograph honestly cannot show.')
      + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:${HOUSE};padding:14px 26px">`
      + `<a href="${SITE}/analyser/" style="color:#fff;text-decoration:none;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase">Begin the free analysis</a>`
      + `</td></tr></table>`
      + mailP('It takes about four minutes and needs no account.', 'font-size:12px;color:#636764;margin-top:10px;');
    lines = ['THE NEXT ONE COMES ON MONDAY', '',
      'Thank you for subscribing. The journal publishes one piece a week, on Monday, and each one will arrive here as it goes out.']
      .concat(fromLines('subscribed'), ['',
        'It is written to be useful whether or not you ever buy anything from us — what holds up, what does not, and how to tell the difference.', '',
        'While you wait, the skin analysis is free and open now: ' + SITE + '/analyser/']);
  } else {
    subject = 'You are on the list';
    body += mailH1('You are on the list')
      + mailEyebrow(HOUSES)
      + mailP('Thank you for registering. When ordering opens you will hear from us before anyone else — that is the entire purpose of the list, and it is the only list we keep.', `font-size:16px;color:${INK};`)
      + mailP('We have not set a date, and we would rather say that plainly than guess at one.')
      + fromPara('joined the list')
      + mailH2('You do not have to wait for us')
      + mailP('The skin analysis is free, open now, and does not depend on the launch. One photograph and sixteen questions; a written assessment comes back to this address — read zone by zone, with a note on what a single photograph honestly cannot show.')
      + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:${HOUSE};padding:14px 26px">`
      + `<a href="${SITE}/analyser/" style="color:#fff;text-decoration:none;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase">Begin the free analysis</a>`
      + `</td></tr></table>`
      + mailP('It takes about four minutes and needs no account.', 'font-size:12px;color:#636764;margin-top:10px;')
      + `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:2px solid ${CHAMP};margin:30px 0 0"><tr><td style="padding:18px 0 0">`
      + `<div style="font:500 11px/1.6 -apple-system,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${MID}">What we are building</div>`
      + mailP('Every Zero Lines formulation is made to do two things at once. There is an immediate effect, visible the same day. And there is a lasting one, which builds quietly over weeks of consistent use. Most of the industry sells the first and implies the second. We would rather tell you which is which.', 'margin-top:10px;')
      + `</td></tr></table>`;
    lines = ['YOU ARE ON THE LIST', '',
      'Thank you for registering. When ordering opens you will hear from us before anyone else — that is the entire purpose of the list, and it is the only list we keep.', '',
      'We have not set a date, and we would rather say that plainly than guess at one.']
      .concat(fromLines('joined the list'), ['',
        'The skin analysis is free and open now: ' + SITE + '/analyser/', '',
        'Every Zero Lines formulation is made to do two things at once — an immediate effect, visible the same day, and a lasting one that builds over weeks.']);
  }

  /* An answer to somebody's own enquiry is not list mail. It carries no
     unsubscribe in either part — offering to take them off a list they never
     joined would tell them they had joined one. */
  const transactional = kind === 'contact' || kind === 'appointment';
  body += mailFoot(transactional ? '' : unsubUrl);

  lines.push('', 'The Zero Lines collection is in pre-launch and not yet available to purchase.');
  if (!transactional) {
    lines.push(unsubUrl
      ? 'To stop hearing from us: ' + unsubUrl
      : 'If you would rather not hear from us again, reply and we will take you off the list.');
  }
  lines.push('', 'zerolines.life');

  return { subject, html: mailShell(body), text: lines.join('\n') };
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
    ['Preferred house', row.house], ['Preferred timing', row.timing],
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
    /* An appointment is answered by a person picking a time, so the glance has
       to carry the two things that decide it: which house, and when. */
    : row.form === 'appointment'
      ? [row.house || 'no house given', row.timing || 'no timing given', row.name]
          .filter(Boolean).join(' · ').slice(0, 110)
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
    // An appointment needs answering by a person, today, and it should not be
    // filed alongside the signups by a subject line that calls it one.
    subject: `${row.form === 'contact' ? 'Message' : row.form === 'appointment' ? 'Appointment' : 'Waitlist'}: ${row.email}`,
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

/* ---- is there a person at the other end? -----------------------------------

   On 21 August 2026 this endpoint took 190 contact submissions in fourteen
   hours, all from one address in Romania, behind five rotating desktop user
   agents and eighty-six harvested email addresses, carrying one sentence —
   "Hi, I wanted to know your price" — machine-translated into forty languages.

   The honeypot did not catch it: the bot renders the form and leaves the
   hidden field alone. The rate limit did not catch it either, and that is the
   instructive part — it ran at roughly four submissions per fifteen minutes
   against a limit of five per fifteen. It had measured the limit and sat under
   it. A burst limit only stops bursts.

   Two things went wrong and only one of them was noise in an inbox. Every new
   address gets a Zero Lines welcome, so the house sent eighty-six unsolicited
   letters to strangers whose addresses had been harvested from somewhere else.
   That is how a sending domain gets blocklisted, and it is the more expensive
   failure by far.

   So the screen is layered, cheapest first, and nothing that fails it is ever
   mailed — not the house, and above all not the address that was typed in. */

/* Addresses that are not inboxes.

   Six of the eighty-six the bot submitted ended in @vtext.com — Verizon's
   SMS gateway, where a message to 4702184072@vtext.com arrives as a text on
   somebody's telephone. Three of those people got one, signed Zero Lines.

   That is the whole attack in one line. The bot was not writing to Roberto; it
   was using this form as a mailer, and the payload was the welcome letter the
   site sends to any new address. Nobody buys face cream through a carrier SMS
   gateway, and nobody legitimate reaches a skincare house from a ten-minute
   throwaway, so neither is worth the argument. */
const GATEWAY_DOMAINS = [
  'vtext.com', 'vzwpix.com', 'txt.att.net', 'mms.att.net', 'tmomail.net',
  'messaging.sprintpcs.com', 'pm.sprint.com', 'msg.fi.google.com', 'vmobl.com',
  'email.uscc.net', 'mymetropcs.com', 'sms.cricketwireless.net', 'mmst5.tracfone.com',
  'myboostmobile.com', 'text.republicwireless.com', 'page.nextel.com',
];
const THROWAWAY_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  'grr.la', '10minutemail.com', 'yopmail.com', 'temp-mail.org', 'tempmail.com',
  'trashmail.com', 'dispostable.com', 'maildrop.cc', 'getnada.com', 'mohmal.com',
  'fakeinbox.com', 'spam4.me', 'throwawaymail.com', 'moakt.com', 'emailondeck.com',
];

async function screenSubmission(env, row, token, ip) {
  /* Turnstile, if it is configured. Cloudflare's own challenge: invisible to a
     person, and the one measure here that a headless browser cannot simply
     pace itself under. It is off until TURNSTILE_SECRET exists, so the site
     keeps working untouched until the keys are made. */
  if (env.TURNSTILE_SECRET) {
    if (!token) return 'no-challenge';
    try {
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || undefined }),
      });
      const out = await v.json();
      if (!out.success) return 'challenge-failed';
    } catch (e) {
      /* Cloudflare unreachable. Let it through rather than lose a real enquiry;
         the limits below still apply. */
    }
  }

  /* A day's worth, from one address. The burst limit above catches a machine
     going flat out; this catches one pacing itself. Real use of this site runs
     at one to four submissions a day across every form, so ten from a single
     address in twenty-four hours is already far outside anything a person
     does — including a shared office or a household behind one NAT.

     Three, not ten. Ten was the number that felt safely above human use;
     Roberto's question was why a bot should be allowed ten free shots at all,
     and there is no good answer. Three weeks of real traffic is fifteen
     submissions from twelve people across every form on the site, so three in
     a day from one address is still far more headroom than anybody has ever
     needed, and it cuts what a single machine can extract by seventy per
     cent. */
  const domain = row.email.slice(row.email.indexOf('@') + 1);
  if (GATEWAY_DOMAINS.includes(domain)) return 'sms-gateway';
  if (THROWAWAY_DOMAINS.includes(domain)) return 'throwaway-address';

  const day = new Date(Date.now() - 86400000).toISOString();
  if (row.ip_hash) {
    try {
      const r = await env.ZL_LEADS.prepare(
        `SELECT COUNT(*) AS n FROM leads WHERE ip_hash = ? AND created_at > ?`
      ).bind(row.ip_hash, day).first();
      if (r && r.n >= 3) return 'ip-daily-cap';
    } catch (e) { /* never the reason a real lead is lost */ }
  }

  /* The same address, over and over. Ten of the eighty-six came back ten times
     each. Nobody writes to a shop four times in a day; the one who genuinely
     needs to can reply to the letter they were already sent. */
  try {
    const r = await env.ZL_LEADS.prepare(
      `SELECT COUNT(*) AS n FROM leads WHERE email = ? AND created_at > ?`
    ).bind(row.email, day).first();
    if (r && r.n >= 3) return 'email-daily-cap';
  } catch (e) { /* as above */ }

  /* Link spam. Deliberately two, not one: a person may well paste the page
     they are asking about, and no real enquiry to a skincare house carries a
     pair of URLs. No attempt is made to read the sentence itself — the flood
     above asked, in perfect Lithuanian, exactly what a customer would ask, and
     a filter that catches it catches the customer too. */
  const msg = row.message || '';
  if ((msg.match(/https?:\/\/|www\./gi) || []).length >= 2) return 'links';
  if (/\[url=|\[link=|<a\s+href/i.test(msg)) return 'markup';

  return null;
}

/* Resend's free plan allows a hundred messages a day, and on 21 August this
   endpoint tried to send about two hundred and seventy-six. The screen above
   is what stops that happening; this is what makes it impossible.

   Counted from what was actually sent rather than from submissions, and
   tiered: the reply to a visitor is suppressed before the alert to the house,
   because a missed alert is a lost lead while a missed auto-reply is only a
   silence the house can fill by hand. */
async function mailBudget(env) {
  const max = Number(env.MAIL_DAILY_MAX || 70);
  try {
    const since = new Date(Date.now() - 86400000).toISOString();
    /* Screened rows are excluded even though the flood of 21 August genuinely
       did consume the allowance: those rows will never be mailed again, and
       counting yesterday's spend against them would hold the house silent for
       a day after every attack — exactly when a real enquiry is most likely to
       be missed. The ceiling exists to stop us generating a flood, not to
       punish the present for one already survived. */
    const r = await env.ZL_LEADS.prepare(
      `SELECT COALESCE(SUM(emailed),0) + COALESCE(SUM(notified),0) AS n
         FROM leads WHERE created_at > ? AND spam IS NULL`
    ).bind(since).first();
    const sent = (r && r.n) || 0;
    return { reply: sent < max * 0.7, notice: sent < max, sent, max };
  } catch (e) {
    return { reply: true, notice: true, sent: 0, max };
  }
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
  if (!['waitlist', 'contact', 'newsletter', 'appointment'].includes(form)) {
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

  /* ---- an appointment request -------------------------------------------
     Somebody asking to be seen at one of the houses is not a signup, and until
     now the only way to ask was a WhatsApp link on the contact page — which
     wants a stranger's phone number before anybody has said a word to them.

     Two fields the other forms do not have: which house, and when would suit.
     They are folded into `message` rather than given columns of their own,
     because this repository has no migration tooling — the schema is whatever
     was typed into the D1 console once — and a lazy ALTER TABLE in the request
     path is a worse thing to own than two labelled lines of text. The export
     is a CSV a person reads; a person can read this.

     `row.message` itself keeps the visitor's own words, so the alert to the
     house can show the three things separately and the person's sentence is
     not buried between two labels. */
  if (form === 'appointment') {
    row.house = (get('house') || get('preferred-house') || get('location')).slice(0, 80) || null;
    row.timing = (get('timing') || get('preferred-timing') || get('when')).slice(0, 120) || null;
  }
  const stored = form === 'appointment'
    ? ([row.house ? 'Preferred house: ' + row.house : null,
        row.timing ? 'Preferred timing: ' + row.timing : null,
        row.message ? '\n' + row.message : null]
        .filter(Boolean).join('\n').slice(0, 5000) || null)
    : row.message;

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

  /* Everything the burst limiter cannot see. A submission that fails is still
     written down — the caps above count rows, so a screen that dropped them
     would lose its own memory between requests, and Roberto should be able to
     look at what arrived. It is flagged, kept out of the export and the
     stats, and no mail of any kind goes out for it. */
  const verdict = await screenSubmission(
    env, { ...row, message: stored }, get('cf-turnstile-response'),
    request.headers.get('CF-Connecting-IP'));

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
      `INSERT INTO leads (created_at, form, email, name, message, source, referrer, country, ua, ip_hash, emailed, spam)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(row.created_at, row.form, row.email, row.name, stored, row.source,
           row.referrer, row.country, row.ua, row.ip_hash, verdict || null).run();
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

  /* Nothing that failed the screen is mailed — not the alert, and above all
     not the address that was typed in, which on 21 August belonged to
     eighty-six strangers who had never heard of this house. */
  const budget = env.RESEND_KEY && !verdict ? await mailBudget(env) : { reply: false, notice: false };

  if (env.RESEND_KEY && !verdict) {
   if (budget.notice) {
    // The alert always fires. Roberto wants to know about the second visit too.
    const notice = buildNotice(row);
    ctx.waitUntil(
      sendMail(env, env.ZL_NOTIFY || REPLY_TO, notice.subject, notice.html, notice.text, email)
        .then((ok) => mark(env, rowId, 'notified', ok))
    );
   }

    /* An appointment request is answered, and it is answered with a receipt.
       Not the waitlist letter — "you are on the list" to somebody who asked to
       be seen in Gibraltar on Thursday would be both wrong and a little
       insulting, and they have joined no list. What goes back says the request
       arrived, repeats the house and the week so a mistake can be caught, and
       says plainly that nothing is booked until a person writes. It carries no
       unsubscribe and no offer, because it is a reply to their own request.

       Every request gets one, not only the first: `alreadyWelcomed` asks
       whether somebody has been introduced to the house, which is the wrong
       question to ask of a second visit in March. The opt-out is still
       honoured, on the same reasoning as the contact form below it. */
    if (form === 'appointment') {
      if (!optedOut && budget.reply) {
        ctx.waitUntil((async () => {
          const w = buildWelcome('appointment', '', null, { house: row.house, timing: row.timing });
          const ok = await sendMail(env, email, w.subject, w.html, w.text);
          await mark(env, rowId, 'emailed', ok);
        })());
      } else {
        ctx.waitUntil(mark(env, rowId, 'emailed', true));
      }
    /* Two reasons to stay quiet. Someone who has written to us before does not
       need welcoming twice; and the analyser records its own leads here, having
       just sent that person a full written assessment — inviting them to go and
       take the analysis would be the house not paying attention. */
    } else if (!alreadyWelcomed && !optedOut && budget.reply
        && row.source !== 'analyser' && row.source !== 'analyser-started') {
      const kind = form === 'contact' ? 'contact' : form === 'newsletter' ? 'newsletter' : 'waitlist';
      /* The article they were reading, if they were reading one. Fetched inside
         waitUntil rather than before it, because it is a subrequest to the
         assets binding and nobody's "thank you" should wait on it. Not fetched
         at all for a contact reply, which never names the piece: the letter
         would have thrown the answer away, and a subrequest nobody reads is
         still a subrequest. */
      ctx.waitUntil((async () => {
        // A reply to an enquiry is not list mail, so it carries no unsubscribe.
        const unsub = kind === 'contact' ? '' : await unsubLink(email, env);
        const piece = kind === 'contact' ? null : await pieceFromSource(env, row.source);
        const w = buildWelcome(kind, unsub, piece);
        const ok = await sendMail(env, email, w.subject, w.html, w.text, undefined, unsub);
        await mark(env, rowId, 'emailed', ok);
      })());
    } else if (budget.reply) {
      // Nothing to send, so nothing is owed. Recording it as handled keeps the
      // "have they been welcomed" question answerable from one column.
      ctx.waitUntil(mark(env, rowId, 'emailed', true));
    }
    /* Deliberately not marked when the ceiling is what stopped the reply.
       `emailed` carries two meanings — this address has been written to, and
       this row needs nothing further — and the budget above counts it as the
       first. Writing it here for a letter that was never sent would inflate
       the meter with its own suppressions and hold the ceiling down. */
  }
  const inserted = true;

  /* Without JavaScript the browser posted a real form and is waiting for a
     page. With it, zl.js reads the JSON and never navigates. */
  if ((request.headers.get('accept') || '').includes('text/html')) {
    return Response.redirect(SITE + '/thank-you/', 303);
  }
  // `form` is echoed so a caller can tell an appointment request from a signup
  // without having to look at its own markup for the answer.
  return new Response(JSON.stringify({ ok: true, recorded: inserted, form }), { status: 200, headers: cors });
}

/* The list, as a file, on demand. Netlify owned this view; now it is a URL the
   house holds the key to. */
async function handleExport(url, env) {
  if (!env.HOOK_SECRET || !safeEqual(url.searchParams.get('k') || '', env.HOOK_SECRET)) {
    return new Response('Not found.', { status: 404 });
  }
  /* `spam IS NULL` rather than a flag to set by hand: the screen writes the
     reason it refused into that column, so the export is every row no
     automated check objected to, and the objections stay readable in the
     database for anyone who wants to know what was turned away. */
  const { results } = await env.ZL_LEADS.prepare(
    `SELECT created_at, form, email, name, message, source, referrer, country
       FROM leads WHERE unsubscribed = 0 AND spam IS NULL ORDER BY created_at DESC`
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

/* ---------------------------------------------------------------------------
   The same list, counted.

   Every form on the site has posted a `source` since the day the endpoint was
   written — seventy-odd of them, one per page — and nothing has ever read the
   column. So the question the field exists to answer ("does the piece on
   alternatives bring people in, or is it all the homepage?") could only be
   answered by downloading the CSV and counting by hand.

   Aggregates only, deliberately. The export already hands over the addresses to
   whoever holds the key; this returns shapes, so it can be left open in a tab
   without a lead list sitting on the screen.
   --------------------------------------------------------------------------- */
async function handleStats(url, env) {
  if (!env.HOOK_SECRET || !safeEqual(url.searchParams.get('k') || '', env.HOOK_SECRET)) {
    return new Response('Not found.', { status: 404 });
  }
  const all = (sql, ...bind) => env.ZL_LEADS.prepare(sql).bind(...bind).all().then((r) => r.results || []);
  const one = (sql, ...bind) => env.ZL_LEADS.prepare(sql).bind(...bind).first();

  /* Rows and people are different numbers and both matter: one person who
     joined from the homepage and then finished the analyser is two rows and one
     address, and reading the first as reach would overstate it. */
  const [byForm, bySource, byDay, totals, unsubbed, newsletter] = await Promise.all([
    all(`SELECT form, COUNT(*) AS rows_n, COUNT(DISTINCT email) AS people
           FROM leads WHERE spam IS NULL GROUP BY form ORDER BY rows_n DESC`),
    /* One row per page, with the forms as columns rather than as extra rows.
       The question is "which page brings people in", and a source split across
       four rows has to be added up by eye before it can be compared with the
       homepage. */
    all(`SELECT COALESCE(source, '(none)') AS source,
                COUNT(*) AS rows_n, COUNT(DISTINCT email) AS people,
                SUM(CASE WHEN form = 'waitlist'    THEN 1 ELSE 0 END) AS waitlist,
                SUM(CASE WHEN form = 'newsletter'  THEN 1 ELSE 0 END) AS newsletter,
                SUM(CASE WHEN form = 'contact'     THEN 1 ELSE 0 END) AS contact,
                SUM(CASE WHEN form = 'appointment' THEN 1 ELSE 0 END) AS appointment
           FROM leads WHERE spam IS NULL GROUP BY source ORDER BY rows_n DESC, source`),
    // Ninety days is as far back as a weekly rhythm is legible on one screen.
    all(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS rows_n, COUNT(DISTINCT email) AS people
           FROM leads WHERE spam IS NULL GROUP BY day ORDER BY day DESC LIMIT 90`),
    one(`SELECT COUNT(*) AS rows_n, COUNT(DISTINCT email) AS people, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM leads WHERE spam IS NULL`),
    one(`SELECT COUNT(DISTINCT email) AS people FROM leads WHERE unsubscribed = 1 AND spam IS NULL`),
    one(`SELECT COUNT(DISTINCT email) AS people FROM leads
          WHERE form = 'newsletter' AND spam IS NULL AND email NOT IN (SELECT email FROM leads WHERE unsubscribed = 1)`),
  ]);

  /* The ledger may not exist yet — it is created by the first journal run, not
     by a migration — and a missing table must not take the whole page down. */
  let journal = [];
  try {
    journal = await all(`SELECT slug, COUNT(*) AS sent, MAX(sent_at) AS last_at
                           FROM sends GROUP BY slug ORDER BY last_at DESC`);
  } catch (e) { journal = []; }

  const body = {
    generated_at: new Date().toISOString(),
    /* What the screen refused, and why. Not noise to hide: if this number ever
       runs close to the real one, the thresholds are wrong in one direction or
       the other, and this is where that shows. */
    screened_out: await all(`SELECT spam AS reason, COUNT(*) AS rows_n FROM leads
                              WHERE spam IS NOT NULL GROUP BY spam ORDER BY rows_n DESC`),
    totals: {
      rows: (totals && totals.rows_n) || 0,
      people: (totals && totals.people) || 0,
      unsubscribed_people: (unsubbed && unsubbed.people) || 0,
      journal_list: (newsletter && newsletter.people) || 0,
      first_at: (totals && totals.first_at) || null,
      last_at: (totals && totals.last_at) || null,
    },
    by_form: byForm,
    by_source: bySource,
    by_day: byDay,
    journal_sends: journal,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* ---------------------------------------------------------------------------
   MONDAY.

   Sixty-six forms on this site subscribe people to a weekly journal letter, and
   the welcome mail says so in those words — "each one will arrive here as it
   goes out". Nothing on the account was capable of sending it. Articles
   published themselves on their date, week after week, and the people who had
   asked to be told heard nothing: the one promise the site makes with no
   machinery behind it.

   The cron in wrangler.toml wakes this at 08:00 UTC on Mondays. It looks up the
   article dated today in the same schedule.json the publish gate reads — one
   calendar, still — reads that article's own headline and standfirst off its
   own page, and writes a short letter round them. Nothing about the piece is
   retyped here: if the article's words change, so do the letter's.

   IT SHIPS DISARMED, AND THAT IS DELIBERATE.

   ZL_SEND_LIVE defaults to "no" in wrangler.toml. In that state this function
   does everything except the one irreversible part: it selects the recipients,
   builds the letter, works out each person's unsubscribe link, and writes the
   lot to the log — then returns without calling Resend. Mail to real people is
   the owner's decision and the owner's alone. Set the var to "yes" only when
   somebody has read a dry run and wants it to go.
   --------------------------------------------------------------------------- */

/* One invocation on the free plan may make 50 subrequests to the open internet,
   and each send is one. (Calls to D1 and to the assets binding go to Cloudflare
   services and are counted separately, against a much larger allowance, so it
   is only the sends that have to fit.) Forty leaves headroom and the list is
   nowhere near it.

   Read the deferral honestly, though: nothing re-runs by itself. The ledger
   makes a second run *safe* — it would pick up exactly the people the first did
   not reach and nobody twice — but the next cron is next Monday with the next
   article, and the preview below cannot send. So a run that defers anybody
   leaves that remainder unsent until somebody does something about it, and the
   report says how many, which is the point of reporting it. Before this number
   is anywhere near being reached, the run wants splitting across days. */
const JOURNAL_MAX_PER_RUN = 40;

/* Resend's default allowance is a couple of requests a second, and a burst that
   trips it fails the sends rather than queueing them. Wall-clock waiting is not
   CPU time, and a cron has fifteen minutes. */
const JOURNAL_GAP_MS = 550;

/* The calendar answers a second question now: not only "has this article's day
   come" but "whose day is today". One article per date, which is what the
   manifest has always held; if two ever shared one, the first wins and the
   second is never announced, so do not put two on a Monday. */
function slugForDate(date) {
  for (const slug of Object.keys(SCHEDULE)) if (SCHEDULE[slug] === date) return slug;
  return null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* "Monday 10 August 2026". Written out here rather than left to toLocaleDateString,
   which on a Worker can answer in whatever locale the runtime feels like. */
function longDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return iso;
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* The handful of entities the site's own titles actually contain. A title read
   out of <title> arrives HTML-encoded and would be encoded twice by esc(); a
   headline read out of JSON-LD arrives as plain text and must not be touched.
   This decodes the first so both take the same path. */
function decodeEntities(s) {
  return String(s || '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|rsquo|lsquo|ldquo|rdquo);/g, (m, n) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
      mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    }[n]))
    .replace(/&#(\d{1,5});/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
}

/* What an article says about itself.
 *
 * The letter must not contain a sentence about the piece that the piece does
 * not contain about itself. Every article already carries a BlogPosting
 * headline and description written and checked with the article; taking them
 * from the page at send time means the claim checker has already seen every
 * word that goes out, and a correction to an article corrects the letter too.
 * A second copy of twenty-five headlines in this file would be a second thing
 * to keep true. */
async function articleMeta(env, slug) {
  if (!/^[a-z0-9-]+$/.test(slug || '')) return null;
  let html;
  try {
    const r = await env.ASSETS.fetch(new Request(`${SITE}/blog/${slug}.html`, { method: 'GET' }));
    if (!r || r.status !== 200) return null;
    html = await r.text();
  } catch (e) {
    return null;
  }

  let title = null, standfirst = null;
  for (const block of html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    try {
      const data = JSON.parse(block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
      if (data && data['@type'] === 'BlogPosting') {
        title = data.headline || null;
        standfirst = data.description || null;
        break;
      }
    } catch (e) { /* one unparseable block must not lose the others */ }
  }
  if (!title) {
    const t = html.match(/<title>([^<]*)<\/title>/i);
    // The <title> is written for a search result, so it carries the house name.
    if (t) title = decodeEntities(t[1]).replace(/\s*[|—-]\s*Zero Lines\s*$/, '').trim();
  }
  if (!standfirst) {
    const d = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (d) standfirst = decodeEntities(d[1]).trim();
  }
  if (!title) return null;
  return {
    slug,
    url: `${SITE}/blog/${slug}.html`,
    title: title.slice(0, 160),
    standfirst: (standfirst || '').slice(0, 320) || null,
  };
}

/* A `source` names a page, and only some pages are pieces. Category hubs and
   the journal index are lists of writing, not writing. */
async function pieceFromSource(env, source) {
  const m = /^blog\/([a-z0-9-]+)$/.exec(String(source || ''));
  if (!m || m[1].indexOf('category-') === 0) return null;
  return articleMeta(env, m[1]);
}

/* The Monday letter. Deliberately shorter than the welcome: it exists to say
   what is up and step out of the way. Same parts, so it arrives as post from
   the same house. */
function buildJournalLetter(piece, date, unsubUrl) {
  const body = mailH1(esc(piece.title))
    + mailEyebrow(`The journal &middot; ${esc(longDate(date))}`)
    + (piece.standfirst ? mailP(esc(piece.standfirst), `font-size:16px;color:${INK};`) : '')
    + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:${HOUSE};padding:14px 26px">`
    + `<a href="${piece.url}" style="color:#fff;text-decoration:none;font:500 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:2.4px;text-transform:uppercase">Read this week&rsquo;s piece</a>`
    + `</td></tr></table>`
    + mailP('It is free to read and asks nothing of you.', 'font-size:12px;color:#636764;margin-top:10px;')
    + mailP('One piece a week, on Monday, and no more than that. It is written to be useful whether or not you ever buy anything from us — what holds up, what does not, and how to tell the difference.')
    + mailFoot(unsubUrl);

  const text = [
    (piece.title || '').toUpperCase(), '',
    'The journal — ' + longDate(date), '',
    piece.standfirst || '', '',
    'Read it: ' + piece.url, '',
    'One piece a week, on Monday, and no more than that. It is written to be useful whether or not you ever buy anything from us — what holds up, what does not, and how to tell the difference.', '',
    'The Zero Lines collection is in pre-launch and not yet available to purchase.',
    unsubUrl ? 'To stop hearing from us: ' + unsubUrl : '', '',
    'zerolines.life',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  return { subject: piece.title, html: mailShell(body), text };
}

/* The whole run, in one function so that the cron and the preview cannot drift.
   opts.date  — which day's article to announce (defaults to today, UTC)
   opts.dry   — force a dry run whatever the environment says */
async function sendJournal(env, opts) {
  const o = opts || {};
  const date = o.date || new Date().toISOString().slice(0, 10);
  const slug = slugForDate(date);
  /* Three separate reasons to stay quiet, and the report names which one, so
     that a Monday on which nothing arrived can be explained without reading the
     code. An armed var with no RESEND_KEY behind it is the one worth naming
     loudest: it looks exactly like a live run from the outside. */
  const why = o.dry ? 'this run was asked for as a dry run'
    : env.ZL_SEND_LIVE !== 'yes' ? 'ZL_SEND_LIVE is not "yes"'
      : !env.RESEND_KEY ? 'ZL_SEND_LIVE is "yes" but there is no RESEND_KEY to send with'
        : null;
  const live = why === null;
  const report = { date, slug, live, article: null, considered: 0, already_sent: 0, sent: 0, failed: 0, deferred: 0, recipients: [] };
  if (!live) report.dry_run_because = why;

  if (!slug) {
    /* The calendar currently ends on 25 January 2027, and the cron will go on
       firing every Monday after that. A Monday with nothing dated to it is the
       ordinary case, not a fault: no letter goes, and the log says why. */
    report.note = 'No article is dated ' + date + '. Nothing to announce.';
    return report;
  }
  const piece = await articleMeta(env, slug);
  if (!piece) {
    report.note = 'The page for ' + slug + ' could not be read, so nothing was sent.';
    return report;
  }
  report.article = { slug: piece.slug, title: piece.title, url: piece.url };

  /* The ledger. It exists so that a second run — a retry, a hand-triggered
     catch-up, a cron that fired twice — cannot send the same piece to the same
     person again. There is no migration tooling in this repository, so the
     table makes itself; CREATE TABLE IF NOT EXISTS is cheap and idempotent, and
     the unique index makes the double send impossible rather than unlikely. */
  await env.ZL_LEADS.prepare(
    `CREATE TABLE IF NOT EXISTS sends (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       email TEXT NOT NULL,
       slug TEXT NOT NULL,
       sent_at TEXT NOT NULL)`
  ).run();
  await env.ZL_LEADS.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS sends_email_slug ON sends (email, slug)`
  ).run();

  const done = await env.ZL_LEADS.prepare(`SELECT COUNT(*) AS n FROM sends WHERE slug = ?`).bind(slug).first();
  report.already_sent = (done && done.n) || 0;

  /* Newsletter subscribers only.
     A waitlist registration was answered with "when ordering opens you will
     hear from us before anyone else — that is the entire purpose of the list".
     Sending that person a weekly letter about skincare writing is precisely the
     thing they were promised would not happen, and the fact that they might
     enjoy it is not the point. They can subscribe; every page offers it.

     unsubscribed is set on every row belonging to an address, so one exclusion
     covers a person who registered from four different pages. */
  const { results } = await env.ZL_LEADS.prepare(
    `SELECT DISTINCT email FROM leads
      WHERE form = 'newsletter'
        AND email NOT IN (SELECT email FROM leads WHERE unsubscribed = 1)
        AND email NOT IN (SELECT email FROM sends WHERE slug = ?)
      ORDER BY email`
  ).bind(slug).all();

  let list = results || [];
  report.considered = list.length;
  if (list.length > JOURNAL_MAX_PER_RUN) {
    report.deferred = list.length - JOURNAL_MAX_PER_RUN;
    list = list.slice(0, JOURNAL_MAX_PER_RUN);
  }

  /* The letter is the same for everybody except the unsubscribe link, so a dry
     run logs it once in full and then, per recipient, the parts that differ.
     Between the two, the log holds exactly what each person would have been
     sent — without five hundred copies of the same HTML in it. */
  if (!live) {
    const sample = buildJournalLetter(piece, date, `${SITE}/unsubscribe?e=…&t=…`);
    console.log('journal DRY RUN — nothing was sent, because ' + why + '.');
    console.log('journal letter subject: ' + sample.subject);
    console.log('journal letter text:\n' + sample.text);
    console.log('journal letter html:\n' + sample.html);
  }

  for (let i = 0; i < list.length; i++) {
    const to = list[i].email;
    const unsub = await unsubLink(to, env);
    const entry = {
      to,
      subject: piece.title,
      unsubscribe: unsub,
      // What sendMail() puts on the wire for a list message. RFC 8058.
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      sent: false,
    };
    if (!live) {
      entry.dry_run = true;
      console.log('journal would send: ' + JSON.stringify(entry));
      report.recipients.push(entry);
      continue;
    }
    const letter = buildJournalLetter(piece, date, unsub);
    const ok = await sendMail(env, to, letter.subject, letter.html, letter.text, undefined, unsub);
    entry.sent = ok;
    if (ok) {
      report.sent++;
      /* Written after the send, not before. A row inserted first would mark
         somebody as reached by a message that failed, and nothing would ever
         try again — the same shape of bug the `emailed` column was carrying
         until it was fixed. The narrow risk left is a send that succeeds and a
         write that fails; that costs one duplicate, which is the cheaper of the
         two mistakes. */
      try {
        await env.ZL_LEADS.prepare(
          `INSERT OR IGNORE INTO sends (email, slug, sent_at) VALUES (?, ?, ?)`
        ).bind(to, slug, new Date().toISOString()).run();
      } catch (e) {
        console.log('journal: sent to ' + to + ' but could not record it');
      }
    } else {
      report.failed++;
      console.log('journal: send failed for ' + to + ' — it will be retried on the next run');
    }
    report.recipients.push(entry);
    if (i < list.length - 1) await new Promise((res) => setTimeout(res, JOURNAL_GAP_MS));
  }
  return report;
}

/* A dry run on demand, so that "it ships disarmed" is something a person can
   check on a Tuesday rather than a claim in a comment. Same key as the export.
   It cannot send: the dry flag is set here, not read from the environment.
     /__forms/journal?k=SECRET                 — today's letter, as JSON
     /__forms/journal?k=SECRET&date=2026-08-17 — any Monday's
     /__forms/journal?k=SECRET&html=1          — the letter itself, to look at */
async function handleJournalPreview(url, env) {
  if (!env.HOOK_SECRET || !safeEqual(url.searchParams.get('k') || '', env.HOOK_SECRET)) {
    return new Response('Not found.', { status: 404 });
  }
  const date = (url.searchParams.get('date') || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? url.searchParams.get('date') : undefined;

  if (url.searchParams.get('html')) {
    /* Read the clock once. Called twice, a preview opened in the last second of
       a Sunday could look up one day's article and date the letter to another. */
    const day = date || new Date().toISOString().slice(0, 10);
    const slug = slugForDate(day);
    const piece = slug && await articleMeta(env, slug);
    if (!piece) return new Response('No article is dated that day.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const letter = buildJournalLetter(piece, day, `${SITE}/unsubscribe?e=you@example.com&t=preview`);
    return new Response(letter.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const report = await sendJournal(env, { date, dry: true });
  return new Response(JSON.stringify(report, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
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

  /* Until August 2026 every image lived flat in /assets/. They now sit in
     /assets/img/<section>/, and the in-article figures gained a blog- prefix.
     The old URLs were live long enough to be indexed, so a miss at the old
     address is looked for in each new home and answered with a permanent
     redirect rather than a 404. Five HEAD-cheap asks, only on a path that
     already missed. */
  const flat = p.match(/^\/assets\/([^/]+\.(?:webp|png|jpg))$/i);
  if (flat) {
    const name = flat[1];
    const names = [name];
    if (/-inline-\d\.webp$/.test(name) && !name.startsWith('blog-')) names.push('blog-' + name);
    for (const dir of ['products', 'people', 'journal', 'pages', '_archive']) {
      for (const n of names) {
        const where = `/assets/img/${dir}/${n}`;
        const r = await ask(where);
        if (r.status !== 404) return Response.redirect(new URL(where, url).toString(), 301);
      }
    }
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
  /* The extensionless form of every directory. The analyser's own footer linked
     /science, /protocol, /products, /story and /contact without the trailing
     slash while all 80 other pages linked them with it — so each of those pages
     was answering at two URLs, and the analyser was quietly voting for the
     wrong one. The links are fixed; these entries stop anyone who types or
     bookmarks the short form from landing on a duplicate. */
  '/science': '/science/',
  '/protocol': '/protocol/',
  '/products': '/products/',
  '/story': '/story/',
  '/testimonials': '/testimonials/',
  '/contact': '/contact/',
  '/blog': '/blog/',
  '/thank-you': '/thank-you/',
  '/products/syringe': '/products/line-corrector/',
  '/products/syringe-refill': '/products/line-corrector-refill/',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/__forms') return handleForm(request, env, ctx);
    if (url.pathname === '/__forms/export') return handleExport(url, env);
    if (url.pathname === '/__forms/stats') return handleStats(url, env);
    if (url.pathname === '/__forms/journal') return handleJournalPreview(url, env);
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
    return ct.includes('text/html') ? addChallenge(hideUnpublished(res), env) : res;
  },

  /* Mondays, 08:00 UTC, from the cron in wrangler.toml.
   *
   * The date comes from the event rather than the clock so that a replay of a
   * missed trigger announces the article that trigger was for, not whichever
   * one happens to be current when Cloudflare gets round to it.
   *
   * A dry run is the default and is not an error; see sendJournal above. To
   * exercise this without waiting for Monday, either open
   * /__forms/journal?k=HOOK_SECRET, or run
   *   npx wrangler dev --test-scheduled   then   curl "localhost:8787/__scheduled"
   */
  async scheduled(event, env, ctx) {
    const date = new Date(event.scheduledTime || Date.now()).toISOString().slice(0, 10);
    try {
      const report = await sendJournal(env, { date });
      console.log('journal run: ' + JSON.stringify({ ...report, recipients: report.recipients.length }));
    } catch (e) {
      /* Rethrown so the trigger is recorded as failed. A cron that swallows its
         own errors reports a healthy week in which nobody was written to. */
      console.log('journal run failed: ' + (e && e.message ? e.message : e));
      throw e;
    }
  },
};
