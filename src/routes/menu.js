const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/menu — anyone can view the menu, no login required
router.get("/", (req, res) => {
  res.json({ menu: db.getMenu() });
});

// PUT /api/menu/:id/stock — update how many of an item are left today.
// Protected with a simple shared secret rather than full admin accounts,
// since this is a one-person shop. Send it as a header, e.g. with curl:
//
//   curl -X PUT http://localhost:4000/api/menu/meatpie/stock \
//     -H "Content-Type: application/json" \
//     -H "x-admin-key: YOUR_ADMIN_KEY" \
//     -d '{"stock": 10}'
//
router.put("/:id/stock", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Invalid admin key." });
  }

  const { stock } = req.body || {};
  if (typeof stock !== "number" || stock < 0) {
    return res.status(400).json({ error: "stock must be a non-negative number." });
  }

  const menu = db.getMenu();
  const item = menu.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });

  item.stock = stock;
  db.saveMenu(menu);
  res.json({ item });
});

module.exports = router;
