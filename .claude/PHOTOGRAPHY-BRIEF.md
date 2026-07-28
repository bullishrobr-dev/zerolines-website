# Zero Lines — photography direction

Paste these into whichever generator you use (Nodaro, Midjourney, ChatGPT, Gemini).
They share a house style deliberately, so the set reads as one shoot rather than twelve prompts.

Save results into `assets/` using the filenames given. WebP if the tool offers it, otherwise
JPEG or PNG — tell me and I will convert and wire them in.

---

## The house style — keep this constant across every image

> Editorial beauty photography for a clinical-luxury skincare house. Shot on a Hasselblad with
> an 80mm lens, large soft north-facing window light from camera-left, one subtle white bounce
> to fill. Warm neutral palette: alabaster, bone, warm greige, with a single muted sea-teal
> accent. Matte finish, fine natural film grain, no gloss, no HDR, no beauty-app smoothing.
> Visible real skin texture including pores and fine lines. Calm, quiet, expensive. Absolutely
> no text, no logos, no watermarks, no lettering of any kind anywhere in the frame.

**That last sentence matters most.** Your current peeling gel image came out reading "AQUA PEL"
and the refill "RENEU Skincare". Always include the no-text instruction, and always check the
result before it goes near the site.

---

## PRIORITY 1 — Product shots

This is the biggest gap. The six shots currently disagree with each other: one is a wide
landscape, one is a full lifestyle scene, and the refill has no shot at all. Consistency here is
the single largest difference between your site and La Mer's.

**Shoot all six identically.** Same camera height, same distance, same light, same surface.

> [HOUSE STYLE] Single skincare product standing centred on a seamless warm-alabaster surface
> against a seamless warm-alabaster background, no visible horizon line. Soft directional light
> from camera-left casting one long soft shadow to the right. Camera at product mid-height,
> straight on, product occupying the central 60% of a 4:5 vertical frame. Unbranded matte white
> [FORM], with a brushed muted sea-teal [DETAIL]. Completely blank packaging — no text, no
> label, no logo, no lettering, no numbers.

Substitute per product:

| File | FORM | DETAIL |
|---|---|---|
| `product-peeling.webp` | airless pump bottle, 50ml, clear body showing a faintly teal-tinted gel | cap and base ring |
| `product-syringe.webp` | slim horizontal precision applicator with a tapered tip, lying on the surface | plunger and tip |
| `product-serum.webp` | tall slim dropper bottle, 30ml | dropper collar |
| `product-day-cream.webp` | short wide jar, 50ml | lid |
| `product-night-cream.webp` | short wide jar, 50ml, very slightly deeper in body | lid |
| `product-syringe-refill.webp` | small sealed cartridge standing upright beside its applicator | end cap |

Leave them **unbranded**. Your logo can be applied cleanly afterwards — that is far more
reliable than asking a model to render "zero lines" and getting "RENEU Skincare".

---

## PRIORITY 2 — The hero

The current hero works, but it is a stock-feeling portrait rather than yours.

`hero-model-primary.webp` — 4:5 vertical
> [HOUSE STYLE] Portrait of a woman aged about 45, three-quarter turn toward camera, gaze
> direct and calm, the faintest closed-mouth smile. Luminous healthy skin with visible pores and
> genuine fine lines around the eyes — not retouched away. Dark hair, softly waved, worn back
> from the face. Cream silk shirt. Background a smooth gradient from warm bone on the left to
> the palest sea-teal on the right. She sits in the right two-thirds of the frame, leaving the
> left third as clean empty background for headline type. Shoulders down, relaxed, quietly
> confident. No text anywhere.

That empty left third is not optional — it is where the headline sits.

Two more in the same sitting, for other pages:

`hero-model-secondary.webp` — same woman, profile, eyes closed, fingertips resting at the jaw.
`hero-model-third.webp` — a second woman, aged about 55, silver hair, same light and background.

---

## PRIORITY 3 — Texture

Your gel textures are already the strongest images you own — they carry the brand colour
naturally. Worth extending the family.

`texture-gel.webp` — 16:9
> [HOUSE STYLE] Extreme macro of a translucent sea-teal cosmetic gel drawn in a single smooth
> S-curve across seamless white, tiny suspended air bubbles catching the light, sharp specular
> highlights along the ridge. Clean, clinical, jewel-like. No text.

`texture-cream.webp` — 16:9
> [HOUSE STYLE] Extreme macro of a rich ivory cream in one sculptural swirl on seamless warm
> alabaster, soft peaks holding their shape, matte finish. No text.

`texture-water.webp` — 16:9
> [HOUSE STYLE] Extreme macro of a single water droplet on skin, the surface tension holding a
> perfect dome, skin texture visible beneath and slightly out of focus behind. No text.

---

## PRIORITY 4 — Place

`story-source.webp` — 21:9
> [HOUSE STYLE] High Pyrenean landscape at first light, low mist in the valley, a thin
> meltwater stream in the foreground catching the sky. Cool blue-grey shadows against warm
> amber light on the peaks. Quiet, remote, untouched. No people. No text.

`story-laboratory.webp` — 4:5
> [HOUSE STYLE] A researcher in a white coat at a laboratory bench, shot from behind and to the
> side so the face is not the subject, hands working with clean glassware. Shallow depth of
> field, warm neutral tones, no clutter. No text, no labels, no signage.

---

## Aspect ratios, so nothing gets cropped badly

| Use | Ratio |
|---|---|
| Hero, portraits, product | 4:5 vertical |
| Editorial bands | 16:10 |
| Full-bleed landscape | 21:9 |
| Texture macros | 16:9 |
| Social share cards | 1200×630 (I generate these from your images automatically) |

---

## Check every result before it ships

1. **Any text visible anywhere?** Reject it. This is the failure that put another brand's name on
   your homepage.
2. **Hands and fingers correct?** Generators still get these wrong.
3. **Does the skin look real?** Plastic, poreless skin undermines a skincare brand more than a
   slightly imperfect shot ever would.
4. **Does it sit with the others?** Hold it beside the rest of the set. If the light or the
   background tone disagrees, reshoot rather than accept it.
