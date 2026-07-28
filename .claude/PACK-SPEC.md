# Zero Lines — pack design specification

Taken from the one existing mockup that is genuinely on-brand
(`assets/product-day-cream.webp`). Every generated pack must match it, so the six
read as one line rather than six unrelated objects.

## The bottle

- **Form**: airless pump bottle, cylindrical, softly rounded shoulders.
- **Body**: clear/frosted glass showing the white product inside.
- **Cap**: brushed soft sea-teal (`#6BBFBF` — a gentle teal, NOT a bright cyan),
  occupying roughly the top third, with a fine seam line where it meets the body.
- **Base ring**: the same brushed teal, roughly the bottom eighth.
- **Background**: seamless white, soft contact reflection beneath, no horizon line.

## The label, top to bottom, centred

1. A stylised **"Z" monogram** in the same teal — two angled bars forming a Z,
   with a small teal leaf shape tucked at the lower right of the letterform.
2. **`zero lines`** — lowercase, dark warm grey, clean geometric sans, generously
   letterspaced. This is the wordmark and it is always lowercase.
3. **Product name** — dark warm grey, title case, two lines, slightly smaller.
4. **Descriptor** — two lines, smaller again, medium grey.
5. **`50 ml`** — smallest, medium grey.

## The six, with exact label copy

| # | Product name (2 lines) | Descriptor (2 lines) | Size |
|---|---|---|---|
| 01 | Bio-Renewal / Peeling Gel | Gentle Weekly Renewal / + Surface Clarity | 50 ml |
| 02 | Precision Collagen / Activation Syringe | Targeted Application / + Collagen Support | 15 ml |
| 03 | BioSignal / Facial Serum | Deep Hydration / + Bio-Signal Delivery | 30 ml |
| 04 | Environmental Shield / Day Cream | Daily Barrier Hydration / + Pollution Defence | 50 ml |
| 05 | Renewal and Repair / Night Cream | Deep Overnight Hydration / + Barrier Renewal | 50 ml |
| 06 | Precision Collagen / Activation Refill | Refill Cartridge / + Collagen Complex | 15 ml |

**Claim discipline on packaging.** The current syringe mockup reads "Precision
Wrinkle Smoothing" — a wrinkle-treatment claim baked into pixels, on a product
with no substantiation, which greps cannot catch and regulators can. It is
replaced above with "Targeted Application". No pack may carry the word *wrinkle*,
any percentage, or any efficacy claim.

## Form exceptions

- **02 Syringe** — not a bottle. A slim horizontal precision applicator: white
  barrel, brushed teal plunger at one end, brushed teal collar and a fine tapered
  white tip at the other. Reads as a precision instrument, not a medical syringe.
  No needle, ever. Label runs along the barrel.
- **06 Refill** — **box only, no bottle.** The user was explicit: the refill is
  represented by its carton alone.

## The boxes

Slim rectangular carton, uncoated warm-white board with a subtle texture.
Same label hierarchy as the bottle, printed in the same teal and warm grey, with
a thin teal keyline framing the front panel. Standing upright, three-quarter view
so the front panel and one side panel are both visible. Same seamless white
background and soft contact shadow.

## Photography, identical for every shot

> Product photography on a seamless pure-white background. Large soft box light
> from front-left, white fill card from the right, one soft contact shadow beneath
> the product falling slightly right. Camera at product mid-height, straight on.
> Sharp throughout, true colour, matte finish, no gloss blowout, no HDR, no
> gradient backdrop, no props, no hands, no water droplets. Commercial e-commerce
> quality, tack sharp, high detail.

## Verify every result before installing

1. **Read the label in the render.** Every word must match the table above. This
   is the failure that put "AQUA PEL" and "RENEU Skincare" on the live site.
2. No watermark anywhere.
3. Teal is the soft sea-teal, not a bright cyan.
4. Background is pure seamless white with one soft shadow.
5. If any of the above fails, regenerate. Do not install a near-miss.
