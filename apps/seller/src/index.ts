import "dotenv/config";
import express from "express";
import cors from "cors";
import { createX402Router } from "./x402.js";
import { createStripe402SellerRouter } from "./stripe402.js";
import type { LogEvent } from "shared";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const PORT = Number(process.env.PORT || 4003);
const SELLER_ADDRESS = requireEnv("SELLER_ADDRESS");
const BUYER_URL = process.env.BUYER_URL || "http://localhost:4001";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";
const SERVER_SECRET = process.env.SERVER_SECRET || "change-me-in-production";

async function emitLog(partial: Omit<LogEvent, "id" | "timestamp">) {
  const event: LogEvent = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...partial,
  };
  await fetch(`${BUYER_URL}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {});
}

const app = express();
app.use(cors());

// x402 routes (crypto via EIP-3009)
app.use("/x402", createX402Router(SELLER_ADDRESS, emitLog));

// stripe402 routes (card / crypto via Stripe)
if (STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY) {
  app.use(
    "/stripe402",
    createStripe402SellerRouter(STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, SERVER_SECRET, emitLog),
  );
  console.log("  stripe402 enabled");
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", stripe402: !!(STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY) });
});

app.listen(PORT, () => {
  console.log(`Seller API running on http://localhost:${PORT}`);
  console.log(`  x402:      http://localhost:${PORT}/x402`);
  if (STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY) {
    console.log(`  stripe402: http://localhost:${PORT}/stripe402`);
  }
});
