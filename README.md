# AK Bowl: protein cups website

A 3D order website for **AK Bowl** (AK Brand · Healthy Eats, Instagram [@ak__bowl](https://www.instagram.com/ak__bowl/)).
It's plain HTML/CSS/JS with no build step. The 3D cup uses Three.js, and Three.js and the fonts are bundled locally in `assets/`.

> **Live.** Orders go to AK Bowl on WhatsApp (70 426 400) and into the owner panel's Orders tab. The owner manages everything at `/admin.html`.

## What's inside

| File | What it does |
|---|---|
| `index.html` | Page structure and all styles |
| `scene.js` | 3D cup: clear cup with a crumb base, protein cream and chocolate topping. The lid art and calorie sleeve are drawn live for each flavor, and the lid flips when the flavor changes. You can drag to spin the cup. |
| `app.js` | Flavor cards (sortable), the 10-cup box builder, "inside the cup" layers, compare bars, the flavor sheet, cart, checkout and the wholesale form |
| `data.js` | All the settings: flavors, prices, box deal, delivery fee, promo codes, banner, open/closed, WhatsApp. Edited from the owner panel |
| `admin.html`, `admin.js`, `api/admin.js` | The owner panel and its password-protected server function (see below) |
| `api/order.js`, `api/_lib.js` | Saves website orders for the Orders tab (Upstash Redis) |
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

The owner opens **yoursite.vercel.app/admin.html** (on a phone or laptop), signs in with her **password**, and can:

| Section | What she can change |
|---|---|
| **Orders** | Every order placed on the website: customer, phone (tap to call or WhatsApp), address, cups, total, promo and notes. Status buttons **New → Confirmed → Delivered** (or Cancelled), today's and this week's sales, top flavors, search, export to Excel (CSV). New orders show a badge and refresh every 30 seconds |
| **Today** | Pause or resume orders (with a message), the top banner, and one-tap **sold out** per flavor |
| **Flavors** | Add, edit, delete, hide or reorder flavors. Name, tagline, protein/choco/calories/fat, colors (they drive the 3D cup), "New" badge, and **photo upload** (resized automatically) |
| **Prices & delivery** | Cup price, cups per box, box price (with a live math check), and the delivery fee for orders under a box |
| **Promo codes** | Create codes with a % off, and turn them on or off. Customers type them in the cart |
| **Store & contact** | WhatsApp number for orders, Instagram link, settings backup/restore, discarding changes, signing out |

**Preview** shows the website with the unpublished changes, in that browser only. **Publish** saves everything as one commit to this repo, and Vercel redeploys in about a minute.

How it works: all the settings live in `data.js` between the `AK-CONFIG` markers. The panel talks to a small Vercel Function (`api/admin.js`). The function checks the password, then reads and commits `data.js` (and any new photos) through the GitHub API in one commit, and Vercel redeploys. There's no database and it costs $0.

### Setup (one time, about 3 minutes)

1. **Make a GitHub key.** Go to https://github.com/settings/personal-access-tokens/new. Name it `AK Bowl owner panel`, set it to expire in 1 year, choose **Only select repositories → `ak-bowl`**, and set **Repository permissions → Contents: Read and write**. Generate it and copy it.
2. **Put it in Vercel, not on anyone's phone.** Vercel → the ak-bowl project → **Settings → Environment Variables**, add:
   - `GITHUB_TOKEN` = the key from step 1
   - `ADMIN_PASSWORD` = the owner's password (10+ characters, e.g. `AkBowl-Cups-2026!`)
3. **Redeploy:** Vercel → **Deployments → ⋯ on the latest → Redeploy**. Environment variables only apply to new deployments.
4. The owner opens `/admin.html` and signs in with the password. She stays signed in for 30 days on that device.

5. **Orders database (for the Orders tab):** Vercel → the ak-bowl project → **Storage → Create Database → Upstash (Redis)** → free plan → **Connect** it to this project. That adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. Then **Redeploy**.

How orders get saved: when a customer taps "Send order on WhatsApp", the site also sends the order to `api/order.js`, which checks it, limits spam (15 orders per hour per connection) and stores it in the database. WhatsApp opens either way. Customer details stay in the private database, never in the public GitHub repo. Until the database is connected, the Orders tab shows these setup steps and the website keeps working normally.

- **To change the password:** edit `ADMIN_PASSWORD` in Vercel and redeploy. Everyone gets signed out.
- **When the key expires (after 1 year):** make a new one, replace `GITHUB_TOKEN`, and redeploy.
- The GitHub key never reaches the browser; only the server function uses it.

## Launch checklist

- [x] Demo labels and the noindex tag removed. `admin.html` and `/api` stay hidden from search (`robots.txt`, `vercel.json`).
- [ ] Vercel environment variables set: `ADMIN_PASSWORD`, `GITHUB_TOKEN`, and the Upstash Redis database connected.
- [ ] One real test order placed from a phone, checked in WhatsApp and in the Orders tab, then deleted.
- [ ] Owner checks every flavor's nutrition in the panel (see "Confirm with AK Bowl" above).
- [ ] Optional: a custom domain (Vercel → Settings → Domains), then put the link in the Instagram bio.

Fonts (League Spartan, Montserrat, Pinyon Script) are under the SIL Open Font License, via Fontsource. Three.js is MIT-licensed.
