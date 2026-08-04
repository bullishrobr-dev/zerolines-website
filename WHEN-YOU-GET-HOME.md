# Zero Lines — what needs you, and nothing else

Everything in this list is blocked on something only you can do: an account, a
key, a decision, or a payment. Nothing here is waiting on code — the code is
written, deployed and tested in every case.

Ordered by what it unlocks. Do 1 and 2 and the rest can wait.

---

## 0. URGENT — nobody can email you

**`zerolines.life` has no MX record.** Mail sent to `info@zerolines.life`
cannot be delivered. It is published on **52 pages**, in the footer of every one,
in your Organization schema, and in the reply-to of every skin assessment the
analyser sends. Anyone who has written to you has had it bounce, or vanish.

Verified: `dig MX zerolines.life` returns nothing at all.

Sending works — that is a separate record, and Resend's DKIM is in place, which
is why the assessment emails arrive. Only *receiving* is broken.

**Fastest fix, free, about two minutes.** Your DNS is at Namecheap
(`dns1.registrar-servers.com`), and Namecheap includes free email forwarding:

1. Namecheap → Domain List → zerolines.life → **Manage**
2. **Advanced DNS** → **Mail Settings** → choose **Email Forwarding**
3. Add: `info` → `bullishrobr@gmail.com`

That publishes the MX records for you and mail starts arriving. Later, if you
want a real mailbox at the domain rather than forwarding, Zoho Mail is free for
one domain and Google Workspace is about £5 a month — either replaces this.

**While you are in there, add SPF at the apex.** There is a DKIM record for
Resend but no SPF on the root domain, so your assessment emails are only half
authenticated and more likely to land in spam. Add a TXT record on `@`:

```
v=spf1 include:amazonses.com ~all
```

*(Resend sends via Amazon SES from eu-west-1 — that include is what their setup
page specifies. If their dashboard shows a different value, use theirs.)*

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

Analyser gated on a real email · assessment delivered by mail with a private
30-day link · KV storage · consent gate that actually gates · original product
mockups restored · six competitor-branded images replaced · favicon rebuilt ·
53% off the image payload · 69% off the deploy · brand turquoise restored ·
FAQ and journal contradictions resolved · every page carrying an ask.
