const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const requireAuth = require("../middleware/requireAuth");
const paystack = require("../services/paystack");

const router = express.Router();

// POST /api/orders — create an order. Requires sign-in.
// Body: { items: [{ id, qty }], email, phone, address, notes }
router.post("/", requireAuth, async (req, res) => {
  const { items, email, phone, address, notes } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your order has no items." });
  }
  if (!phone || !address) {
    return res.status(400).json({ error: "Phone number and delivery address are required." });
  }

  const menu = db.getMenu();
  const orderLines = [];
  let total = 0;

  // Always trust server-side prices and stock — never the client's numbers.
  for (const { id, qty } of items) {
    const menuItem = menu.find((m) => m.id === id);
    if (!menuItem) return res.status(400).json({ error: `Unknown item: ${id}` });
    const quantity = Math.max(1, Math.min(20, Number(qty) || 1));
    if (menuItem.stock < quantity) {
      return res.status(409).json({ error: `Only ${menuItem.stock} left of ${menuItem.name}.` });
    }
    orderLines.push({ id, name: menuItem.name, price: menuItem.price, qty: quantity });
    total += menuItem.price * quantity;
  }

  // reserve stock immediately so two customers can't both buy the last item
  for (const line of orderLines) {
    const menuItem = menu.find((m) => m.id === line.id);
    menuItem.stock -= line.qty;
  }
  db.saveMenu(menu);

  const order = {
    id: uuid(),
    customerId: req.session.user.id,
    customerName: req.session.user.name,
    email: email || null,
    phone,
    address,
    notes: notes || "",
    items: orderLines,
    total,
    status: "pending_payment",
    paid: false,
    paystackReference: null,
    createdAt: new Date().toISOString(),
  };

  const orders = db.getOrders();

  if (paystack.isConfigured()) {
    if (!email) {
      return res.status(400).json({ error: "An email address is required to pay by card/transfer via Paystack." });
    }
    try {
      const reference = `snack_${order.id}`;
      const callbackUrl = `${process.env.CLIENT_URL || ""}/order-success.html?orderId=${order.id}`;
      const paystackData = await paystack.initializeTransaction({
        email,
        amountNaira: total,
        reference,
        callbackUrl,
        metadata: { orderId: order.id, customerName: order.customerName },
      });
      order.paystackReference = reference;
      orders.push(order);
      db.saveOrders(orders);
      return res.status(201).json({
        order,
        paymentMode: "paystack",
        authorizationUrl: paystackData.authorization_url,
      });
    } catch (err) {
      orders.push(order);
      db.saveOrders(orders);
      return res.status(502).json({
        error: "Could not start Paystack payment: " + err.message,
        order,
      });
    }
  }

  // Demo mode: no Paystack keys configured yet. The order is still created,
  // and the frontend falls back to showing bank details + a WhatsApp handoff.
  orders.push(order);
  db.saveOrders(orders);
  return res.status(201).json({
    order,
    paymentMode: "manual",
    bank: {
      bankName: process.env.BANK_NAME,
      accountName: process.env.ACCOUNT_NAME,
      accountNumber: process.env.ACCOUNT_NUMBER,
    },
    whatsappNumber: process.env.WHATSAPP_NUMBER,
  });
});

// GET /api/orders/:id/verify — check (and record) payment status
router.get("/:id/verify", requireAuth, async (req, res) => {
  const orders = db.getOrders();
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.customerId !== req.session.user.id) {
    return res.status(403).json({ error: "This isn't your order." });
  }

  if (order.paid) return res.json({ order });

  if (!paystack.isConfigured() || !order.paystackReference) {
    return res.json({ order, note: "Not using Paystack for this order — confirm payment manually." });
  }

  try {
    const result = await paystack.verifyTransaction(order.paystackReference);
    if (result.status === "success") {
      order.paid = true;
      order.status = "paid";
      db.saveOrders(orders);
    } else {
      order.status = result.status; // e.g. "failed", "abandoned"
      db.saveOrders(orders);
    }
    return res.json({ order });
  } catch (err) {
    return res.status(502).json({ error: "Could not verify payment: " + err.message, order });
  }
});

// GET /api/orders — this customer's own order history
router.get("/", requireAuth, (req, res) => {
  const orders = db.getOrders().filter((o) => o.customerId === req.session.user.id);
  res.json({ orders });
});

module.exports = router;
