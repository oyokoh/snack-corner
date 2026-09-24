// A deliberately simple, file-based data store.
//
// For a small snack shop this avoids needing to install and run a real
// database. Everything is read from / written to JSON files in /data.
// If your order volume grows a lot, swap this out for a real database
// (Postgres, MongoDB, etc.) — the rest of the app only talks to the
// functions below, so that swap stays contained to this file.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const SEED_DIR = path.join(__dirname, "seed");

const FILES = {
  menu: path.join(DATA_DIR, "menu.json"),
  users: path.join(DATA_DIR, "users.json"),
  orders: path.join(DATA_DIR, "orders.json"),
};

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(FILES.menu)) {
    const seedMenu = fs.readFileSync(path.join(SEED_DIR, "menu.json"), "utf-8");
    fs.writeFileSync(FILES.menu, seedMenu);
  }
  if (!fs.existsSync(FILES.users)) fs.writeFileSync(FILES.users, "[]");
  if (!fs.existsSync(FILES.orders)) fs.writeFileSync(FILES.orders, "[]");
}

function readJSON(file) {
  const raw = fs.readFileSync(file, "utf-8");
  return raw.trim() ? JSON.parse(raw) : [];
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  ensureDataFiles,
  getMenu: () => readJSON(FILES.menu),
  saveMenu: (menu) => writeJSON(FILES.menu, menu),
  getUsers: () => readJSON(FILES.users),
  saveUsers: (users) => writeJSON(FILES.users, users),
  getOrders: () => readJSON(FILES.orders),
  saveOrders: (orders) => writeJSON(FILES.orders, orders),
};
