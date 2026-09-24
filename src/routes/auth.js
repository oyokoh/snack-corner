const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const db = require("../db");

const router = express.Router();

// POST /api/auth/login
// This doubles as sign-up: the first time a name is used, an account is
// created with the password provided. After that, the same name must be
// used with the matching password. This keeps things simple for a small
// snack shop — if you need real accounts with email verification, password
// resets, etc. this is the file to extend.
router.post("/login", async (req, res) => {
  const { name, password } = req.body || {};

  if (!name || !password || !name.trim() || !password.trim()) {
    return res.status(400).json({ error: "Name and password are required." });
  }

  const cleanName = name.trim();
  const key = cleanName.toLowerCase();
  const users = db.getUsers();
  const existing = users.find((u) => u.key === key);

  if (existing) {
    const ok = await bcrypt.compare(password, existing.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "That password doesn't match this name." });
    }
    req.session.user = { id: existing.id, name: existing.name };
    return res.json({ user: req.session.user });
  }

  // first time this name has been used — create the account
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: uuid(), key, name: cleanName, passwordHash, createdAt: new Date().toISOString() };
  users.push(user);
  db.saveUsers(users);

  req.session.user = { id: user.id, name: user.name };
  return res.status(201).json({ user: req.session.user });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ user: null });
});

module.exports = router;
