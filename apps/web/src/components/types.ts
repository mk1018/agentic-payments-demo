export interface LogEvent {
  id: string;
  timestamp: number;
  type: "request" | "response_402" | "signing" | "response_200" | "error" | "select_payment";
  method: string;
  url: string;
  status?: number;
  txHash?: string;
  message?: string;
  requestBody?: unknown;
  responseBody?: unknown;
}

export type Actor = "buyer" | "seller" | "facilitator" | "blockchain" | "stripe";

export interface Step {
  id: string;
  from: Actor;
  to: Actor;
  label: string;
  detail?: string;
  color: string;
  txHash?: string;
  data?: unknown;
  isSystem?: boolean;
  isPaymentSelect?: boolean;
}

export type DemoMode = "x402" | "stripe402-card";

export interface LaneConfig {
  key: Actor;
  emoji: string;
  name: string;
  sub: string;
}

export const COLORS: Record<string, { text: string; bg: string; border: string; line: string }> = {
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    line: "#3b82f6",
  },
  green: {
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    line: "#22c55e",
  },
  yellow: {
    text: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    line: "#eab308",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    line: "#a855f7",
  },
  orange: {
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    line: "#f97316",
  },
  red: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", line: "#ef4444" },
  gray: {
    text: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    line: "#6b7280",
  },
  cyan: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    line: "#06b6d4",
  },
};

export const X402_LANES: LaneConfig[] = [
  { key: "buyer", emoji: "🤖", name: "Buyer Agent", sub: "買い手" },
  { key: "seller", emoji: "🖥️", name: "Seller API", sub: "売り手" },
  { key: "facilitator", emoji: "🏦", name: "Facilitator", sub: "決済仲介" },
  { key: "blockchain", emoji: "⛓️", name: "Base Sepolia", sub: "ブロックチェーン" },
];

export const MPP_LANES: LaneConfig[] = [
  { key: "buyer", emoji: "🤖", name: "Buyer Agent", sub: "買い手" },
  { key: "seller", emoji: "🖥️", name: "Seller API", sub: "売り手" },
  { key: "stripe", emoji: "💳", name: "Stripe", sub: "決済処理" },
  { key: "blockchain", emoji: "⛓️", name: "Blockchain", sub: "ステーブルコイン" },
];
