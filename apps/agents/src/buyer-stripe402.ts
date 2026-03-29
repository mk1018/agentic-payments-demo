import { encodeHeader, decodeHeader } from "@stripe402/core";
import type { PaymentRequiredResponse, PaymentPayload, PaymentResponse } from "@stripe402/core";
import type { Product, PurchaseResult, Receipt, LogEvent } from "shared";

type StripePaymentType = "card" | "crypto";

export async function createStripe402Buyer(
  sellerBaseUrl: string,
  waitForPaymentSelection: () => Promise<StripePaymentType>,
  emitLog: (event: LogEvent) => void,
) {
  let clientId: string | undefined;

  function log(partial: Omit<LogEvent, "id" | "timestamp">) {
    emitLog({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...partial,
    });
  }

  async function createPaymentMethod(type: StripePaymentType): Promise<string> {
    const res = await fetch(`${sellerBaseUrl}/create-payment-method`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = (await res.json()) as { paymentMethodId: string };
    return json.paymentMethodId;
  }

  async function paidFetch(url: string, options?: RequestInit): Promise<{ body: unknown }> {
    const method = options?.method || "GET";
    const reqBody = options?.body ? JSON.parse(options.body as string) : undefined;

    const headers = new Headers(options?.headers);
    if (clientId) {
      const payload: PaymentPayload = { stripe402Version: 1, clientId };
      headers.set("PAYMENT", encodeHeader(payload));
    }

    log({
      type: "request",
      method,
      url,
      message: `リクエスト送信: ${method} ${url}`,
      requestBody: reqBody,
    });
    const firstRes = await fetch(url, { ...options, headers });

    if (firstRes.status !== 402) {
      const text = await firstRes.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      const prHeader = firstRes.headers.get("payment-response");
      if (prHeader) {
        const pr = decodeHeader<PaymentResponse>(prHeader);
        clientId = pr.clientId;
        log({
          type: "response_200",
          method,
          url,
          status: firstRes.status,
          message: `レスポンス受信 (${firstRes.status}) — クレジット残高: ${pr.creditsRemaining} units`,
          responseBody: body,
        });
      } else {
        log({
          type: "response_200",
          method,
          url,
          status: firstRes.status,
          message: `レスポンス受信 (${firstRes.status})`,
          responseBody: body,
        });
      }
      return { body };
    }

    // 402 received
    log({
      type: "response_402",
      method,
      url,
      status: 402,
      message: "402 Payment Required — Stripe決済が必要です",
    });

    const prHeader = firstRes.headers.get("payment-required");
    if (!prHeader) throw new Error("402 but no PAYMENT-REQUIRED header");
    const paymentRequired = decodeHeader<PaymentRequiredResponse>(prHeader);
    const accepts = paymentRequired.accepts[0];

    // Ask user to select payment method
    log({
      type: "select_payment",
      method: "STRIPE402",
      url: "select",
      message: `決済方法を選択してください — ${accepts.amount} units ($${(accepts.amount / 10000).toFixed(4)})`,
    });

    const paymentType = await waitForPaymentSelection();

    log({
      type: "signing",
      method: "STRIPE402",
      url: "select",
      message:
        paymentType === "card"
          ? `[Buyer] 決済方法選択: 💳 カード決済`
          : `[Buyer] 決済方法選択: 🪙 クリプト決済（Stripe経由）`,
    });

    // Create payment method via seller
    const paymentMethodId = await createPaymentMethod(paymentType);

    log({
      type: "signing",
      method: "STRIPE402",
      url: "payment",
      message:
        paymentType === "card"
          ? `[Buyer] カードトークン化完了（Stripe.js） — PaymentMethod: ${paymentMethodId}`
          : `[Buyer] クリプトウォレット接続完了 — PaymentMethod: ${paymentMethodId}`,
    });

    const payload: PaymentPayload = {
      stripe402Version: 1,
      paymentMethodId,
      topUpAmount: accepts.minTopUp,
    };

    log({
      type: "request",
      method,
      url,
      message: `Stripe決済済み — 再送: ${method} ${url}`,
      requestBody: { paymentType, paymentMethodId, topUpAmount: accepts.minTopUp },
    });

    const retryHeaders = new Headers(options?.headers);
    retryHeaders.set("PAYMENT", encodeHeader(payload));
    retryHeaders.set("X-PAYMENT-TYPE", paymentType);
    const secondRes = await fetch(url, { ...options, headers: retryHeaders });

    if (secondRes.status === 402) {
      log({ type: "response_402", method, url, status: 402, message: "402 — Stripe決済後も失敗" });
      throw new Error(`Stripe決済失敗: ${method} ${url}`);
    }

    const text = await secondRes.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    const responseHeader = secondRes.headers.get("payment-response");
    if (responseHeader) {
      const pr = decodeHeader<PaymentResponse>(responseHeader);
      clientId = pr.clientId;
      log({
        type: "response_200",
        method,
        url,
        status: 200,
        message: `Stripe決済完了 — PaymentIntent: ${pr.chargeId || "N/A"}, クレジット残高: ${pr.creditsRemaining} units`,
        responseBody: { stripe: pr, data: body },
      });
    } else {
      log({
        type: "response_200",
        method,
        url,
        status: secondRes.status,
        message: `レスポンス受信 (${secondRes.status})`,
        responseBody: body,
      });
    }

    return { body };
  }

  async function run(): Promise<void> {
    const { body: catalog } = await paidFetch(`${sellerBaseUrl}/products`);
    const products = catalog as Product[];

    if (products.length === 0) {
      log({
        type: "error",
        method: "GET",
        url: `${sellerBaseUrl}/products`,
        message: "商品が見つかりません",
      });
      return;
    }

    const selected = products[0];
    log({
      type: "request",
      method: "SYSTEM",
      url: "",
      message: `「${selected.name}」を選択 — 詳細取得中`,
    });

    const { body: detailBody } = await paidFetch(`${sellerBaseUrl}/products/${selected.id}`);
    const detail = detailBody as Product;
    log({
      type: "response_200",
      method: "GET",
      url: `${sellerBaseUrl}/products/${selected.id}`,
      status: 200,
      message: `商品詳細取得完了: 「${detail.name}」 $${detail.price}`,
      responseBody: detail,
    });

    log({ type: "request", method: "SYSTEM", url: "", message: `「${detail.name}」を購入中` });
    const { body: purchaseBody } = await paidFetch(`${sellerBaseUrl}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: detail.id, buyerAddress: "stripe-buyer" }),
    });
    const purchaseResult = purchaseBody as PurchaseResult;
    log({
      type: "response_200",
      method: "POST",
      url: `${sellerBaseUrl}/purchase`,
      status: 200,
      message: `購入完了: 領収書ID ${purchaseResult.receiptId}`,
      responseBody: purchaseResult,
    });

    const { body: receiptBody } = await paidFetch(
      `${sellerBaseUrl}/receipt/${purchaseResult.receiptId}`,
    );
    const receipt = receiptBody as Receipt;
    log({
      type: "response_200",
      method: "GET",
      url: `${sellerBaseUrl}/receipt/${receipt.id}`,
      status: 200,
      message: `領収書取得完了`,
      responseBody: receipt,
    });
    log({
      type: "response_200",
      method: "SYSTEM",
      url: "",
      status: 200,
      message: `フロー完了！ 領収書: ${receipt.id}`,
    });
  }

  return { run };
}
