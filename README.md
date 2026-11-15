# AK Bowl: protein cups website (concept demo)

A 3D order website for **AK Bowl** (AK Brand · Healthy Eats, Instagram [@ak__bowl](https://www.instagram.com/ak__bowl/)).
It's plain HTML/CSS/JS with no build step. The 3D cup uses Three.js, and Three.js and the fonts are bundled locally in `assets/`.

> **Concept demo.** The site is marked `noindex` and carries a "Concept demo" label. **Orders are live**: checkout opens WhatsApp to AK Bowl (70 426 400) with the whole order typed out, and the customer taps Send.

## What's inside

| File | What it does |
|---|---|
| `index.html` | Page structure and all styles |
| `scene.js` | 3D cup: clear cup with a crumb base, protein cream and chocolate topping. The lid art and calorie sleeve are drawn live for each flavor, and the lid flips when the flavor changes. You can drag to spin the cup. |
| `app.js` | Flavor cards (sortable), the 10-cup box builder, "inside the cup" layers, compare bars, the flavor sheet, cart, checkout and the wholesale form |
| `data.js` | All the settings: flavors, prices, box deal, delivery fee, promo codes, banner, open/closed, WhatsApp. Edited from the owner panel |
| `admin.html`, `admin.js` | The owner panel (see below) |
| `assets/photos` | AK Bowl's own photos, cropped from their Instagram posts |

## Prices (placeholder, confirm with the client)

- **$3** per cup (changed from the owner panel, or `price` in `data.js`).
- **10 cups (any mix) = $25 with free delivery**, from their Instagram ad. The cart applies it automatically for every 10 cups: 13 cups = $25 + 3 × $3 = **$34**.
- For orders under 10 cups, delivery shows as "Confirmed on WhatsApp".

## Confirm with AK Bowl

- **Peanut Butter:** the lid says 40 g protein, but the calorie sleeve says 25 g. The site uses 25 g, from the sleeve.
- **Pistachio:** 40 g protein, 210 kcal and 16 g fat don't add up (40 g protein + 16 g fat alone is about 300 kcal). Worth checking the label.
- **Oreo:** no nutrition label yet, so the site shows "Full label soon".
- They say "11 flavors", but only 10 appear in their posts.
- The delivery fee for orders under 10 cups.
- Free catches you can mention: the Dark Chocolate lid says "DARC", and the Cheesecake lid says "BE STITRONG".

## Owner panel (`/admin.html`)

The owner opens **yoursite.vercel.app/admin.html** (on a phone or laptop), signs in once, and can:

| Section | What she can change |
|---|---|
| **Today** | Pause or resume orders (with a message), the top banner, and one-tap **sold out** per flavor |
| **Flavors** | Add, edit, delete, hide or reorder flavors. Name, tagline, protein/choco/calories/fat, colors (they drive the 3D cup), "New" badge, and **photo upload** (resized automatically) |
| **Prices & delivery** | Cup price, cups per box, box price (with a live math check), and the delivery fee for orders under a box |
| **Promo codes** | Create codes with a % off, and turn them on or off. Customers type them in the cart |
| **Store & contact** | WhatsApp number for orders, Instagram link, settings backup/restore, discarding changes, signing out |

**Preview** shows the website with the unpublished changes, in that browser only. **Publish** saves everything as one commit to this repo, and Vercel redeploys in about a minute.

How it works: all the settings live in `data.js` between the `AK-CONFIG` markers. The panel reads that file through the GitHub API, edits it, and commits it back with any new photos. There's no server or database, and nothing costs money.

### Creating the access key (one time, ~2 minutes)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `AK Bowl owner panel`. Expiration: 1 year (set a reminder to renew it).
3. **Repository access → Only select repositories →** `ak-bowl`.
4. **Permissions → Repository permissions → Contents: Read and write**.
5. Generate it, copy the key (it starts with `github_pat_`) and paste it into the panel's sign-in screen on the owner's phone. It stays signed in on that device.

The key can only touch this one repository. If it's ever shared by mistake, delete it on GitHub and make a new one. Without signing in, "Look around without signing in" opens a demo of the panel where nothing is saved, which is handy for showing the client.

## Going live (after they say yes)

1. WhatsApp orders are already on (`ORDER_WHATSAPP = '96170426400'` in `app.js`; set it to `''` for demo mode).
2. `index.html`: remove the `noindex` meta tag, the "Concept demo" tag and the footer disclaimer.

Fonts (League Spartan, Montserrat, Pinyon Script) are under the SIL Open Font License, via Fontsource. Three.js is MIT-licensed.
