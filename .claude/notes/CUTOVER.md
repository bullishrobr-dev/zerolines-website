# Cutover — Netlify to Cloudflare

Everything is built, deployed and tested at
**https://zerolines.bullishrobr.workers.dev**. Nothing in production has moved.
This file is the switch.

---

## Read this first

Attaching a custom domain to a Worker requires the domain to be a Cloudflare
zone. That means **changing nameservers at Namecheap**, which moves *all* DNS —
not just the website records, but the MX records that make `info@`, `roberto@`
and `dimitri@` work, and the SPF/DKIM/DMARC that keep Zero Lines mail out of
spam folders.

Mail was broken until this morning. It is not being risked casually: every
record is written out below, and step 2 is verifying the import **before** the
nameservers change, while the old DNS is still authoritative and nothing can
break.

Total time: about fifteen minutes, most of it waiting.

---

## Step 1 — Add the domain to Cloudflare

**dash.cloudflare.com → Add a site → `zerolines.life` → Free plan.**

Cloudflare scans the existing DNS and imports what it finds. It is good at this
and not perfect, which is what step 2 is for.

**Do not change the nameservers yet.** Cloudflare will ask. Say you will do it
later, or simply close the page.

---

## Step 2 — Check every record survived the scan

In **Cloudflare → DNS → Records**, compare against this list. It is the complete
set, read from the live nameservers on 6 August.

### Mail — the ones that matter most

| Type | Name | Value | Priority | Proxy |
|---|---|---|---|---|
| MX | `@` | `mx1.privateemail.com` | 10 | — |
| MX | `@` | `mx2.privateemail.com` | 10 | — |
| TXT | `@` | `v=spf1 include:spf.privateemail.com ~all` | — | — |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | — | — |
| TXT | `default._domainkey` | the Private Email DKIM key | — | — |

### Resend — assessment and confirmation email

| Type | Name | Value | Priority | Proxy |
|---|---|---|---|---|
| TXT | `resend._domainkey` | the Resend DKIM key | — | — |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 | — |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — | — |

There is a matching, orphaned set on `receipts` (`send.receipts` MX and TXT,
`resend._domainkey.receipts`). Nothing uses them — Resend holds one domain, the
apex. Harmless either way; no reason to recreate them by hand if the scan
misses them.

### Google

| Type | Name | Value |
|---|---|---|
| CNAME | `6hj3stnqtm22` | `gv-tq6dlekski7ve2.dv.googlehosted.com` |
| CNAME | `zgcisnx4iq2b` | `gv-it3pqx6in5eaa4.dv.googlehosted.com` |

Workspace verification leftovers. Inert, but free to keep.

The Search Console verification is a `<meta>` tag on the homepage, not DNS. It
travels with the site and needs nothing here.

### The website — these two get replaced

The old records point at Netlify and should be **deleted**, in step 4:

- `ALIAS @ → apex-loadbalancer.netlify.com` (resolving to `75.2.60.5`, `99.83.231.61`)
- `CNAME www → zero-lines-website.netlify.app`

**Anything above that is missing, add by hand before continuing.**

---

## Step 3 — Change the nameservers

Cloudflare gives you two, of the form `xxx.ns.cloudflare.com`.

**Namecheap → Domain List → zerolines.life → Manage → Nameservers → Custom
DNS.** Replace `dns1.registrar-servers.com` and `dns2.registrar-servers.com`
with Cloudflare's pair. Save.

Propagation is usually under an hour. The site and mail keep working throughout
— the old nameservers stay authoritative until the new ones take over, and both
answer the same records.

**Tell me when this is saved.** I will confirm from three public resolvers that
mail is still routing before anything else happens.

---

## Step 4 — Point the domain at the Worker

Mine, once step 3 has propagated. I delete the two Netlify records and attach
`zerolines.life` and `www.zerolines.life` to the Worker as custom domains.

Then I verify, under the header a real browser sends:

- all 38 routes on the live domain
- forms recording to D1
- both emails arriving
- the analyser still working end to end
- mail still delivering to all three mailboxes

---

## If something goes wrong

Nothing here is one-way.

- **Site broken:** point the DNS back at Netlify. That deploy is still live and
  still has working Netlify Forms.
- **Mail broken:** the record set above is the complete restore. Re-add the MX
  pair and mail resumes within the hour.
- **All of it:** set the nameservers back to `dns1/dns2.registrar-servers.com`
  and everything returns to how it was this morning.

The Netlify site is not deleted, and will not be until this has been running
quietly for a week.

---

## After the cutover

- Delete the test rows from the lead list (mine, from checking the forms).
- The analyser Worker keeps its own `/welcome` endpoint, now unused — the
  Netlify webhook that called it will be gone. Harmless; I will remove it on
  the next pass rather than touch a working Worker during a migration.
- Netlify: keep the account until the new setup has a week behind it.
