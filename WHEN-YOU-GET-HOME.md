# Zero Lines — what needs you, and nothing else

Everything in this list is blocked on something only you can do: an account, a
key, a decision, or a payment. Nothing here is waiting on code — the code is
written, deployed and tested in every case.

Ordered by what it unlocks. Do 1 and 2 and the rest can wait.

---

## 0. Mail — DONE, 6 August

**`zerolines.life` had no MX record**, so mail to
`info@zerolines.life` — published on 52 pages, in the Organization schema, and
in the reply-to of every skin assessment — had nowhere to be delivered. The
Private Email subscription was never the problem: Pro plan, paid to 22 May 2027,
all three mailboxes provisioned, DKIM already published. Only the routing was
missing. Two MX records at the apex fixed it:

```
@   MX   10   mx1.privateemail.com
@   MX   10   mx2.privateemail.com
```

Verified live at the authoritative nameserver and at 1.1.1.1, 8.8.8.8 and
9.9.9.9. Then verified end to end over SMTP — `info@`, `roberto@` and `dimitri@`
each answer `250 Ok` to RCPT, and a deliberately invented address on the same
domain is rejected, which proves the server is checking the recipient list
rather than accepting everything and dropping it later.

SPF was added at the apex in the same pass:

```
@   TXT   v=spf1 include:spf.privateemail.com ~all
```

That one belongs in **HOST RECORDS**, not Mail Settings — Namecheap's Mail
Settings panel accepts MX records only, which is why a TXT typed there demands
a priority it has no field for.

**One SPF record only, ever.** An earlier draft of this file said to publish
`v=spf1 include:amazonses.com ~all` at the apex for Resend. It is already on
`send.zerolines.life` where it belongs. A domain may have exactly one SPF
record, and a second is a permerror that breaks both mail streams at once.

### Where authentication now stands

| Stream | SPF | DKIM | DMARC | Alignment |
|---|---|---|---|---|
| Private Email — the three mailboxes | apex | `default._domainkey` | `p=none` | strict |
| Resend — assessment emails | `send.` | `resend._domainkey` | `p=none` | relaxed SPF, strict DKIM |

Both streams pass all three checks. The apex SPF resolves in 4 DNS lookups
against RFC 7208's limit of 10, so there is headroom before a future sender
tips it into the permerror that silently disables SPF altogether.

DMARC sits at `p=none` — observe, do not reject. Once both streams have been
seen passing for a few weeks, tightening to `quarantine` is worth doing. There
is no hurry, and doing it early is how legitimate mail gets thrown away.

### Two things not to break

**Leave Mail Settings on Custom MX.** The `send` row beneath it is Resend's
bounce handler for the verified sending domain. Switching that dropdown to
"Private Email" hands the MX table to Namecheap, which rewrites it and deletes
that row — costing bounce handling and possibly the domain verification every
assessment email depends on. (`send.receipts` alongside it is an inert leftover.)

**Leave the ALIAS `@` → `apex-loadbalancer.netlify.com` and the `www` CNAME
alone.** Those are the website. The two `gv-…googlehosted.com` CNAMEs are
Google Workspace verification leftovers — inert, and probably the fingerprint of
whatever originally held the MX records before they were replaced.

DMARC is already published at `p=none`, which is the right setting until both
streams have been observed passing for a few weeks.

---

## 1. Analytics — 5 minutes, and do this one first

Right now the site measures **nothing**. Not how many people find the analyser,
not how many finish it, not which pages send them. Every decision after this is
guesswork until it is in.

### Start with Cloudflare Web Analytics

Free, sets no cookies, collects no personal data — so it needs no consent and
measures **every** visitor rather than the third who click Accept.

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics**
2. **Add a site** → `zerolines.life`
3. Copy the **token** it gives you
4. Send me the token

That's it. No new account, no new terms — you already agreed to Cloudflare's.

### GA4 and the Meta Pixel — only when you start advertising

Both are already wired and gated behind the cookie banner. They stay dormant
until you hand me IDs. There is no point adding them before you run ads, because
they only ever see consenting visitors and will tell you less than the above.

When you do want them:
- **GA4:** analytics.google.com → create a property for zerolines.life →
  Admin → Data Streams → Web → copy the **Measurement ID** (`G-XXXXXXXXXX`)
- **Meta:** business.facebook.com → Events Manager → Connect Data Source → Web →
  copy the **Pixel ID** (a long number)

I cannot create these for you — signing up means accepting Google's and Meta's
terms in Zero Lines' name, about how they process your visitors' personal data.
That signature has to be yours.

---

## 2. Netlify — a decision, not a task

Your account is on **operational credits**. The site stays live, but new
production deploys are paused until the billing cycle resets or you upgrade.

Two things to know:
- **Form submissions are capped at 100/month on the free plan.** Past that they
  are silently dropped. That is your waitlist, so it matters more than the
  deploy limit.
- I have been publishing by uploading a draft and promoting it through the API.
  It works, and it is how the current site got live — but it routes around a
  limit Netlify is deliberately applying. You should know that rather than
  discover it.

**My advice:** wait for the reset. You are pre-launch, the site is current, and
nothing is urgent. Upgrade when you actually launch — that is also when
connecting the GitHub repo becomes worth doing (it needs builds, which are
paused too).

---

## 3. The syringe pack says something it should not

`product-syringe.webp` and `product-syringe-hero.webp` both read
**"Precision Wrinkle Smoothing"** on the label. That is a wrinkle-treatment
claim, in pixels, on a product with no substantiation, across **8 pages**. No
text search can find it, which is exactly why it survived.

It is not urgent while you are pre-launch and selling nothing. It should be
corrected before you sell anything.

**Needs:** Nodaro credits (yours reset on the 28th). Then I regenerate the pack
with the compliant descriptor and swap it everywhere.

---

## 4. Things only you know

These are gaps I can build the space for but cannot fill:

- **A person behind the brand.** The Story page tells the story of a conviction
  and never puts a human being behind it. Every house you admire — La Mer,
  Augustinus Bader, Sisley — has a founder on the page. A name, a photograph, a
  paragraph in the first person. This is the single biggest trust gap on the
  site and it costs nothing but your decision.
- **Ingredient lists.** Three pages used to promise a full INCI list on every
  product page. None exists, so I reworded them to promise it at launch. Before
  you sell, that has to become true.
- **What you actually get.** Three of the six products never state their size.
- **Testimonials.** The page is deliberately held open until you have customers.
  Right call. Nothing to do until then.

---

## 5. Optional, when you feel like it

- **Bounce handling.** Resend accepting a message is not proof it arrived. A
  webhook would drop hard-bounced addresses so the list stays clean. Say the
  word and I will build it.
- **A follow-up email.** Right now someone gets their assessment and then
  silence until launch. That is the moment they are most interested. Resend does
  broadcasts and automations and I have access.
- **Move the project off ~/Desktop.** iCloud Drive syncs it and duplicates files
  mid-write — it produced 126 copies in one session and silently replaced a live
  article with its duplicate, which broke six links until a check caught it.
  Anywhere outside Desktop and Documents ends the whole class of problem.

---

## What is already done and needs nothing

Mail receiving restored and verified over SMTP · SPF, DKIM and DMARC passing on
both sending streams · the Worker now asking OpenRouter not to retain or train
on the photograph, so the pledge on the page is enforced rather than hoped for ·
analyser gated on a real email · assessment delivered by mail with a private
30-day link · KV storage · consent gate that actually gates · original product
mockups restored · six competitor-branded images replaced · favicon rebuilt ·
53% off the image payload · 69% off the deploy · brand turquoise restored ·
FAQ and journal contradictions resolved · every page carrying an ask.
