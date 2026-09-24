require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const cors = require("cors");

const db = require("./src/db");
const authRoutes = require("./src/routes/auth");
const menuRoutes = require("./src/routes/menu");
const orderRoutes = require("./src/routes/orders");

db.ensureDataFiles();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
app.use(express.json());

app.use(
  session({
    name: "connect.sid",
    secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax",
      // secure:true requires HTTPS — enable this once you deploy behind HTTPS
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// A small public config endpoint so the frontend can show business details
// (phone number, business name) without hardcoding them in the HTML.
app.get("/api/config", (req, res) => {
  res.json({
    businessName: process.env.BUSINESS_NAME || "Snack Corner",
    phoneDisplay: process.env.PHONE_DISPLAY || "",
    bank: {
      bankName: process.env.BANK_NAME || "",
      accountName: process.env.ACCOUNT_NAME || "",
      accountNumber: process.env.ACCOUNT_NUMBER || "",
    },
    whatsappNumber: process.env.WHATSAPP_NUMBER || "",
    paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);

// Serve the frontend
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Snack Corner server running at http://localhost:${PORT}`);
  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.log("Note: PAYSTACK_SECRET_KEY is not set — running in demo payment mode.");
  }
});
