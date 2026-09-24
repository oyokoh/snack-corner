# Snack Corner

A small snack-ordering website: browse the menu, sign in, add items, and pay
by card/bank transfer (via Paystack) or by direct bank transfer.

## What's inside

- **Backend:** Node.js + Express (`server.js`, `src/`)
  - Simple name+password sign-in (passwords hashed with bcrypt, sessions via cookies)
  - Menu, stock, and orders stored in JSON files under `/data` (no database to install)
  - Real payment via [Paystack](https://paystack.com) when you add your API keys — falls
    back to a "pay by bank transfer + confirm on WhatsApp" flow if you haven't yet
- **Frontend:** plain HTML/CSS/JS in `public/` — no build step, no framework

## Running it locally

1. Install [Node.js](https://nodejs.org) 18 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template and fill in your details:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in at least `SESSION_SECRET` and `ADMIN_KEY` (any random
   strings). You can leave the `PAYSTACK_*` keys blank for now — the site will
   run in **demo payment mode** (orders are recorded, and customers are shown
   your bank details + a WhatsApp button instead of a card payment page).
4. Start the server:
   ```bash
   npm start
   ```
5. Open **http://localhost:4000** in your browser.

## Turning on real payments (Paystack)

1. Create a free account at [paystack.com](https://paystack.com) and grab your
   **test** secret & public keys from Settings → API Keys & Webhooks.
2. Put them in `.env`:
   ```
   PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx
   PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxx
   ```
3. Restart the server. Orders will now redirect customers to a real Paystack
   payment page, and `order-success.html` verifies the payment automatically
   when they're redirected back.
4. When you're ready to accept real money, switch to your **live** keys
   (Paystack needs your business verified first) and set `CLIENT_URL` to your
   real deployed domain (not localhost) so the payment redirect works.

## Updating stock

Stock counts live in `data/menu.json` and start from the numbers in
`src/seed/menu.json`. You can hand-edit `data/menu.json`, or update it over
the API with your `ADMIN_KEY`:

```bash
curl -X PUT http://localhost:4000/api/menu/meatpie/stock \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{"stock": 10}'
```

## Project structure

```
server.js                 – app entry point
src/
  db.js                   – simple JSON-file data storage
  seed/menu.json           – starting menu data
  middleware/requireAuth.js
  routes/auth.js           – sign in / sign out / session check
  routes/menu.js            – list menu, update stock
  routes/orders.js          – create orders, verify payment
  services/paystack.js      – Paystack API wrapper
public/
  index.html               – the website
  order-success.html        – Paystack payment-return page
  css/styles.css
  js/app.js                 – frontend logic (calls the API above)
  images/                   – snack photos + background
data/                      – created automatically; not committed to git
```

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Snack Corner"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

`.env` and the runtime data files (`data/users.json`, `data/orders.json`) are
already excluded via `.gitignore` — don't remove them from there, since
`.env` holds secrets and the data files hold real customer information.

## Deploying

This is a plain Node/Express app, so it runs on most Node hosts (Render,
Railway, Fly.io, a VPS, etc.). The general steps are:

1. Push this repo to GitHub.
2. Create a new web service on your host of choice, pointing at this repo.
3. Set the same environment variables from `.env` in the host's dashboard
   (never commit your real `.env` file).
4. Set `CLIENT_URL` to your live domain once you have one, so Paystack's
   redirect back to your site works correctly.
5. Because orders/users are stored in JSON files on disk, make sure your host
   keeps a **persistent disk** for the `/data` folder — on hosts with
   ephemeral filesystems (some free tiers), consider swapping `src/db.js` for
   a real database instead so your data isn't wiped on redeploy.

## Known limitations (worth knowing)

- **Login is intentionally simple.** There's no email verification, password
  reset, or 2FA. It's meant to keep track of returning customers, not to
  protect sensitive data.
- **Data storage is file-based**, which is fine for a small shop but won't
  scale to heavy concurrent traffic or survive a wiped disk on some hosts.
- **Stock is decremented at order time**, before payment is confirmed — if a
  Paystack payment fails after that point, you may want to add logic to
  release the stock back (this is a good next feature to add in
  `src/routes/orders.js`).
