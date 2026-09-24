(function () {
  "use strict";

  const fmt = (n) => "₦" + n.toLocaleString();

  async function api(path, options = {}) {
    const res = await fetch("/api" + path, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || "Something went wrong.");
      err.data = data;
      throw err;
    }
    return data;
  }

  // ---- toast ----
  const toastEl = document.getElementById("toast");
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  // ---- state ----
  let menu = [];
  let cart = {}; // per-browser only, held in memory + localStorage
  let config = null;

  try {
    const saved = localStorage.getItem("snackCart");
    if (saved) cart = JSON.parse(saved);
  } catch (e) { cart = {}; }

  function saveCart() {
    try { localStorage.setItem("snackCart", JSON.stringify(cart)); } catch (e) {}
  }

  function itemById(id) {
    return menu.find((m) => m.id === id);
  }

  // ---- load business config ----
  async function loadConfig() {
    config = await api("/config");
    document.getElementById("pageTitle").textContent = config.businessName + " — fresh snacks, made to order";
    document.getElementById("brandName").textContent = config.businessName;
    document.getElementById("heroBrand").textContent = config.businessName;
    document.getElementById("footerBrand").textContent = config.businessName;
    document.getElementById("contactPhone").textContent = config.phoneDisplay;
    document.getElementById("bankName").textContent = config.bank.bankName;
    document.getElementById("accountName").textContent = config.bank.accountName;
    document.getElementById("accountNumber").textContent = config.bank.accountNumber;
    document.getElementById("orderBankName").textContent = config.bank.bankName;
    document.getElementById("orderAccountName").textContent = config.bank.accountName;
    document.getElementById("orderAccountNumber").textContent = config.bank.accountNumber;
    document.getElementById("waLinkBtn").href = "https://wa.me/" + config.whatsappNumber;
  }

  // ---- load & render menu ----
  const grid = document.getElementById("menuGrid");
  const pending = {};

  async function loadMenu() {
    const data = await api("/menu");
    menu = data.menu;
    menu.forEach((m) => (pending[m.id] = 0));
    renderMenu();
  }

  function renderMenu() {
    grid.innerHTML = "";
    menu.forEach((item) => {
      const remaining = Math.max(0, item.stock - (cart[item.id] || 0));
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="tape"></div>
        <img class="photo" src="${item.photo}" alt="${item.name}">
        <h3>${item.name}</h3>
        <p class="desc">${item.desc}</p>
        <p class="price">${fmt(item.price)}</p>
        <span class="stock-badge ${remaining <= 0 ? "sold-out" : ""}" data-stock="${item.id}">
          ${remaining > 0 ? remaining + " left today" : "Sold out"}
        </span>
        <div class="qty-row">
          <button type="button" data-act="dec" data-id="${item.id}" aria-label="Decrease">−</button>
          <span data-qty="${item.id}">0</span>
          <button type="button" data-act="inc" data-id="${item.id}" ${remaining <= 0 ? "disabled" : ""} aria-label="Increase">+</button>
        </div>
        <button type="button" class="btn btn-solid add-btn" data-act="add" data-id="${item.id}" ${remaining <= 0 ? "disabled" : ""}>
          ${remaining <= 0 ? "Sold out" : "Add to order"}
        </button>
      `;
      grid.appendChild(card);
    });
  }

  function refreshAvailability() {
    menu.forEach((item) => {
      const remaining = Math.max(0, item.stock - (cart[item.id] || 0));
      const badge = grid.querySelector(`[data-stock="${item.id}"]`);
      if (badge) {
        badge.textContent = remaining > 0 ? `${remaining} left today` : "Sold out";
        badge.classList.toggle("sold-out", remaining <= 0);
      }
      const addBtn = grid.querySelector(`button[data-act="add"][data-id="${item.id}"]`);
      const incBtn = grid.querySelector(`button[data-act="inc"][data-id="${item.id}"]`);
      if (addBtn) { addBtn.disabled = remaining <= 0; addBtn.textContent = remaining <= 0 ? "Sold out" : "Add to order"; }
      if (incBtn) incBtn.disabled = remaining <= 0 || pending[item.id] >= remaining;
    });
  }

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const item = itemById(id);
    const remaining = Math.max(0, item.stock - (cart[id] || 0));

    if (act === "inc" && pending[id] < remaining) {
      pending[id] += 1;
      grid.querySelector(`[data-qty="${id}"]`).textContent = pending[id];
    }
    if (act === "dec" && pending[id] > 0) {
      pending[id] -= 1;
      grid.querySelector(`[data-qty="${id}"]`).textContent = pending[id];
    }
    if (act === "add") {
      if (!document.body.classList.contains("logged-in")) {
        document.getElementById("login").scrollIntoView({ behavior: "smooth" });
        showToast("Please sign in to add items to your order");
        return;
      }
      const qty = pending[id] || 1;
      if (qty > remaining) { showToast(`Only ${remaining} left of ${item.name}`); return; }
      cart[id] = (cart[id] || 0) + qty;
      pending[id] = 0;
      grid.querySelector(`[data-qty="${id}"]`).textContent = 0;
      saveCart();
      refreshAvailability();
      renderCart();
      showToast(item.name + " added to your order");
    }
  });

  // ---- cart / receipt ----
  const cartLines = document.getElementById("cartLines");
  const cartTotalRow = document.getElementById("cartTotalRow");
  const cartTotal = document.getElementById("cartTotal");
  const navCartCount = document.getElementById("navCartCount");

  function renderCart() {
    const ids = Object.keys(cart).filter((id) => cart[id] > 0);
    if (ids.length === 0) {
      cartLines.innerHTML = `<p class="empty">Your basket is empty — add something tasty from the menu.</p>`;
      cartTotalRow.style.display = "none";
      navCartCount.textContent = "0";
      return;
    }
    let total = 0, count = 0;
    cartLines.innerHTML = ids.map((id) => {
      const item = itemById(id);
      const lineTotal = item.price * cart[id];
      total += lineTotal;
      count += cart[id];
      return `<div class="cart-line">
        <span class="name">${item.name}</span>
        <div class="ctrl">
          <button type="button" data-id="${id}" data-act="cdec" aria-label="Decrease">−</button>
          <span>${cart[id]}</span>
          <button type="button" data-id="${id}" data-act="cinc" aria-label="Increase">+</button>
          <span style="min-width:5.5em; text-align:right;">${fmt(lineTotal)}</span>
        </div>
      </div>`;
    }).join("");
    cartTotal.textContent = fmt(total);
    cartTotalRow.style.display = "flex";
    navCartCount.textContent = String(count);
  }

  cartLines.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    const item = itemById(id);
    const remaining = Math.max(0, item.stock - (cart[id] || 0)) + (cart[id] || 0); // total stock incl. what's already in cart
    if (btn.dataset.act === "cinc" && cart[id] < remaining) cart[id] += 1;
    if (btn.dataset.act === "cdec") cart[id] = Math.max(0, cart[id] - 1);
    saveCart();
    renderCart();
    refreshAvailability();
  });

  // ---- login ----
  const navCustomerName = document.getElementById("navCustomerName");
  const loggedInName = document.getElementById("loggedInName");
  let currentUser = null;

  function applyLoginState() {
    if (currentUser && currentUser.name) {
      document.body.classList.add("logged-in");
      navCustomerName.textContent = currentUser.name.split(" ")[0];
      loggedInName.textContent = currentUser.name;
    } else {
      document.body.classList.remove("logged-in");
    }
  }

  async function checkSession() {
    try {
      const data = await api("/auth/me");
      currentUser = data.user;
    } catch (e) {
      currentUser = null;
    }
    applyLoginState();
  }

  document.getElementById("loginSubmit").addEventListener("click", async () => {
    const name = document.getElementById("loginName").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");
    errorEl.style.display = "none";

    if (!name || !password) {
      errorEl.textContent = "Please enter your name and password.";
      errorEl.style.display = "block";
      return;
    }

    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ name, password }) });
      currentUser = data.user;
      applyLoginState();
      showToast("Welcome, " + currentUser.name.split(" ")[0] + "!");
      document.getElementById("menu").scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    }
  });

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch (e) {}
    currentUser = null;
    applyLoginState();
    document.getElementById("loginName").value = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("login").scrollIntoView({ behavior: "smooth" });
  }
  document.getElementById("logoutBtn2").addEventListener("click", logout);
  document.getElementById("navLogout").addEventListener("click", (e) => { e.preventDefault(); logout(); });

  document.querySelectorAll(".needs-login").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (!document.body.classList.contains("logged-in")) {
        e.preventDefault();
        document.getElementById("login").scrollIntoView({ behavior: "smooth" });
        showToast("Please sign in first");
      }
    });
  });

  // ---- checkout ----
  const orderMessage = document.getElementById("orderMessage");
  const manualPaymentBox = document.getElementById("manualPaymentBox");

  document.getElementById("checkoutBtn").addEventListener("click", async () => {
    const ids = Object.keys(cart).filter((id) => cart[id] > 0);
    orderMessage.textContent = "";
    manualPaymentBox.style.display = "none";

    if (ids.length === 0) { showToast("Add at least one item first"); return; }

    const email = document.getElementById("custEmail").value.trim();
    const phone = document.getElementById("custPhone").value.trim();
    const address = document.getElementById("custAddress").value.trim();
    const notes = document.getElementById("custNotes").value.trim();

    if (!phone || !address) {
      orderMessage.textContent = "Please fill in your phone number and delivery address.";
      return;
    }

    const items = ids.map((id) => ({ id, qty: cart[id] }));

    try {
      const data = await api("/orders", {
        method: "POST",
        body: JSON.stringify({ items, email: email || undefined, phone, address, notes }),
      });

      if (data.paymentMode === "paystack") {
        showToast("Redirecting you to pay…");
        window.location.href = data.authorizationUrl;
        return;
      }

      // manual / demo mode
      cart = {};
      saveCart();
      renderCart();
      await loadMenu(); // refresh stock counts from the server
      orderMessage.textContent = "Order recorded! Please complete payment below.";
      document.getElementById("orderBankName").textContent = data.bank.bankName;
      document.getElementById("orderAccountName").textContent = data.bank.accountName;
      document.getElementById("orderAccountNumber").textContent = data.bank.accountNumber;
      const message = `Hi! I just placed order #${data.order.id.slice(0, 8)} for ${fmt(data.order.total)} and I'm sending payment now.`;
      document.getElementById("whatsappConfirmLink").href =
        "https://wa.me/" + data.whatsappNumber + "?text=" + encodeURIComponent(message);
      manualPaymentBox.style.display = "block";
    } catch (err) {
      orderMessage.textContent = err.message;
    }
  });

  // ---- mobile nav ----
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  menuToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }));

  // ---- boot ----
  (async function init() {
    try {
      await loadConfig();
      await checkSession();
      await loadMenu();
      renderCart();
      refreshAvailability();
    } catch (err) {
      console.error("Failed to start app:", err);
      showToast("Couldn't load the site — is the server running?");
    }
  })();
})();
