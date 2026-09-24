// Thin wrapper around the Paystack REST API.
// Docs: https://paystack.com/docs/api/transaction/
//
// Uses Node's built-in fetch (Node 18+), so no extra HTTP library needed.

const PAYSTACK_BASE = "https://api.paystack.co";

function isConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function initializeTransaction({ email, amountNaira, reference, callbackUrl, metadata }) {
  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100), // Paystack expects kobo
      reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || "Could not start Paystack payment.");
  }
  return data.data; // { authorization_url, access_code, reference }
}

async function verifyTransaction(reference) {
  const response = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || "Could not verify Paystack payment.");
  }
  return data.data; // includes .status ("success", "failed", "abandoned", ...)
}

module.exports = { isConfigured, initializeTransaction, verifyTransaction };
