import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import { encodeHeader, decodeHeader, deriveClientId } from "@stripe402/core";
import type {
  PaymentRequiredResponse,
  PaymentPayload,
  PaymentResponse,
  RouteConfig,
} from "@stripe402/core";
import { PRODUCT_CATALOG } from "shared";
import type { PurchaseRequest, PurchaseResult, Receipt, LogEvent } from "shared";

interface ClientBalance {
  balance: number;
  stripeCustomerId: string;
}

const balances = new Map<string, ClientBalance>();
const receipts = new Map<string, Receipt>();

export function createStripe402SellerRouter(
  stripeSecretKey: string,
  stripePublishableKey: string,
  serverSecret: string,
  emitLog: (partial: Omit<LogEvent, "id" | "timestamp">) => Promise<void>,
): Router {
  const router = Router();
  const stripe = new Stripe(stripeSecretKey);

  const routes: Record<string, RouteConfig> = {
    "GET /products/": { amount: 100, description: "Product detail access" }, // $0.01
    "POST /purchase": { amount: 1000, description: "Purchase product" }, // $0.10
  };

  // stripe402 middleware
  router.use(async (req, res, next) => {
    const routeKey = Object.keys(routes).find((key) => {
      const [method, path] = key.split(" ");
      return req.method === method && req.path.startsWith(path);
    });

    if (!routeKey) return next();

    const routeConfig = routes[routeKey];
    const paymentHeader = req.headers["payment"] as string | undefined;

    // Check if client has credits
    if (paymentHeader) {
      try {
        const payload = decodeHeader<PaymentPayload>(paymentHeader);

        // If client has existing credits
        if (payload.clientId) {
          const client = balances.get(payload.clientId);
          if (client && client.balance >= routeConfig.amount) {
            client.balance -= routeConfig.amount;
            const response: PaymentResponse = {
              success: true,
              creditsRemaining: client.balance,
              clientId: payload.clientId,
            };
            res.setHeader("PAYMENT-RESPONSE", encodeHeader(response));
            await emitLog({
              type: "response_200",
              method: "STRIPE402",
              url: "deduct",
              message: `[Stripe402] クレジット消費: ${routeConfig.amount} units (残高: ${client.balance})`,
            });
            return next();
          }
        }

        // Process new payment
        if (payload.paymentMethodId) {
          const topUpAmount = payload.topUpAmount || 50000; // default $5.00
          const payType = (req.headers["x-payment-type"] as string) || "card";

          await emitLog({
            type: "signing",
            method: "STRIPE402",
            url: "charge",
            message: `[Stripe402] Stripe課金中（${payType === "crypto" ? "クリプト" : "カード"}）: ${topUpAmount} units ($${(topUpAmount / 10000).toFixed(2)})`,
          });

          // Get card fingerprint for client ID
          const pm = await stripe.paymentMethods.retrieve(payload.paymentMethodId);
          const fingerprint = pm.card?.fingerprint || payload.paymentMethodId;
          const clientId = deriveClientId(fingerprint, serverSecret);

          // Find or create Stripe customer
          let stripeCustomerId: string;
          const existing = balances.get(clientId);
          if (existing) {
            stripeCustomerId = existing.stripeCustomerId;
          } else {
            const customer = await stripe.customers.create({
              payment_method: payload.paymentMethodId,
              metadata: { stripe402_client_id: clientId },
            });
            stripeCustomerId = customer.id;
          }

          // Charge
          const baseParams = {
            amount: Math.ceil(topUpAmount / 100),
            currency: "usd",
            payment_method: payload.paymentMethodId,
            customer: stripeCustomerId,
            confirm: true,
            description: `stripe402 top-up: ${topUpAmount} units (${payType})`,
            metadata: { payment_type: payType, units: String(topUpAmount) },
          };
          const pi =
            payType === "crypto"
              ? await stripe.paymentIntents.create({
                  ...baseParams,
                  payment_method_types: ["crypto"],
                })
              : await stripe.paymentIntents.create({
                  ...baseParams,
                  automatic_payment_methods: { enabled: true, allow_redirects: "never" },
                });

          await emitLog({
            type: "response_200",
            method: "STRIPE402",
            url: "charge",
            message: `[Stripe402] Stripe課金完了（${payType === "crypto" ? "クリプト" : "カード"}）: PaymentIntent ${pi.id}`,
            responseBody: { paymentIntentId: pi.id, amount: topUpAmount },
          });

          // Add credits
          const newBalance = (existing?.balance || 0) + topUpAmount - routeConfig.amount;
          balances.set(clientId, { balance: newBalance, stripeCustomerId });

          const response: PaymentResponse = {
            success: true,
            chargeId: pi.id,
            creditsRemaining: newBalance,
            clientId,
          };
          res.setHeader("PAYMENT-RESPONSE", encodeHeader(response));
          return next();
        }
      } catch (err: any) {
        await emitLog({
          type: "error",
          method: "STRIPE402",
          url: "charge",
          message: `[Stripe402] 決済エラー: ${err.message}`,
        });
        const response: PaymentResponse = {
          success: false,
          creditsRemaining: 0,
          clientId: "",
          error: err.message,
          errorCode: "payment_failed",
        };
        res.status(402).json({});
        res.setHeader("PAYMENT-RESPONSE", encodeHeader(response));
        return;
      }
    }

    // Return 402 with payment requirements
    const paymentRequired: PaymentRequiredResponse = {
      stripe402Version: 1,
      resource: { url: req.originalUrl, description: routeConfig.description },
      accepts: [
        {
          scheme: "stripe",
          currency: "usd",
          amount: routeConfig.amount,
          minTopUp: 50000,
          publishableKey: stripePublishableKey,
          description: routeConfig.description,
        },
      ],
    };
    res.setHeader("PAYMENT-REQUIRED", encodeHeader(paymentRequired));
    res.status(402).json({});
  });

  // Create PaymentMethod (test mode)
  router.post("/create-payment-method", express.json(), async (req, res) => {
    const { type } = req.body as { type: "card" | "crypto" };
    try {
      if (type === "crypto") {
        const pm = await stripe.paymentMethods.create({ type: "crypto" });
        res.json({ paymentMethodId: pm.id, type: "crypto" });
      } else {
        const pm = await stripe.paymentMethods.create({
          type: "card",
          card: { token: "tok_visa" },
        });
        res.json({ paymentMethodId: pm.id, type: "card" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // Product endpoints
  router.get("/products", (_req, res) => {
    res.json(PRODUCT_CATALOG.map(({ id, name, price }) => ({ id, name, price })));
  });

  router.get("/products/:id", (req, res) => {
    const product = PRODUCT_CATALOG.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  });

  router.post("/purchase", express.json(), (req, res) => {
    const { productId, buyerAddress } = req.body as PurchaseRequest;
    const product = PRODUCT_CATALOG.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const receiptId = `rcpt-${Date.now()}`;
    const receipt: Receipt = {
      id: receiptId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      buyerAddress,
      timestamp: Date.now(),
    };
    receipts.set(receiptId, receipt);
    res.json({ success: true, receiptId } as PurchaseResult);
  });

  router.get("/receipt/:id", (req, res) => {
    const receipt = receipts.get(req.params.id);
    if (!receipt) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }
    res.json(receipt);
  });

  return router;
}
