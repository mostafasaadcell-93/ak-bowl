# AK Bowl: protein cups website (concept demo)

A 3D order website for **AK Bowl** (AK Brand · Healthy Eats, Instagram [@ak__bowl](https://www.instagram.com/ak__bowl/)).
It's plain HTML/CSS/JS with no build step. The 3D cup uses Three.js, and Three.js and the fonts are bundled locally in `assets/`.

> **Concept demo.** The site is marked `noindex`, carries a "Concept demo" label, and orders run in demo mode. Keep it that way until AK Bowl approves.

## What's inside

| File | What it does |
|---|---|
| `index.html` | Page structure and all styles |
| `scene.js` | 3D cup: clear cup with a crumb base, protein cream and chocolate topping. The lid art and calorie sleeve are drawn live for each flavor, and the lid flips when the flavor changes. You can drag to spin the cup. |
| `app.js` | Flavor cards (sortable), the 10-cup box builder, "inside the cup" layers, compare bars, the flavor sheet, cart, checkout and the wholesale form |
| `data.js` | Flavors, prices and macros. **Edit prices here.** |
| `assets/photos` | AK Bowl's own photos, cropped from their Instagram posts |

## Prices (placeholder, confirm with the client)

- **$3** per cup (`AK.price` in `data.js`).
- **10 cups (any mix) = $25 with free delivery**, from their Instagram ad. The cart applies it automatically for every 10 cups: 13 cups = $25 + 3 × $3 = **$34**.
- For orders under 10 cups, delivery shows as "Confirmed on WhatsApp".

## Confirm with AK Bowl

- **Peanut Butter:** the lid says 40 g protein, but the calorie sleeve says 25 g. The site uses 25 g, from the sleeve.
- **Pistachio:** 40 g protein, 210 kcal and 16 g fat don't add up (40 g protein + 16 g fat alone is about 300 kcal). Worth checking the label.
- **Oreo:** no nutrition label yet, so the site shows "Full label soon".
- They say "11 flavors", but only 10 appear in their posts.
- WhatsApp number for orders, and the delivery fee for orders under 10 cups.
- Free catches you can mention: the Dark Chocolate lid says "DARC", and the Cheesecake lid says "BE STITRONG".

## Going live (after they say yes)

1. `app.js`: set `ORDER_WHATSAPP = '961XXXXXXXX'`. Orders and wholesale requests will then open WhatsApp with the full text.
2. `index.html`: remove the `noindex` meta tag, the "Concept demo" tag and the footer disclaimer.

Fonts (League Spartan, Montserrat, Pinyon Script) are under the SIL Open Font License, via Fontsource. Three.js is MIT-licensed.
