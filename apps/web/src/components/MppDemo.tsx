"use client";

import { useState, useEffect } from "react";
import type { LogEvent } from "./types";
import { MPP_LANES } from "./types";
import { toMppSteps } from "./steps";
import { SequenceDiagram } from "./SequenceDiagram";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export function MppDemo({ connected }: { connected: boolean }) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    const handler = (ev: CustomEvent<LogEvent>) => {
      const log = ev.detail;
      setLogs((p) => [...p, log]);
      if (log.type === "response_200" && log.message?.includes("Stripe決済完了")) {
        setTotalSpent((p) => p + 0.01);
      }
      if (log.type === "error" || (log.method === "SYSTEM" && log.type === "response_200"))
        setIsRunning(false);
    };
    window.addEventListener("sse-log", handler as EventListener);
    return () => window.removeEventListener("sse-log", handler as EventListener);
  }, []);

  const steps = logs.flatMap(toMppSteps);

  function start() {
    setIsRunning(true);
    setLogs([]);
    setTotalSpent(0);
    fetch(`${API_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "stripe402" }),
    }).catch(() => setIsRunning(false));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 bg-gray-900 border border-gray-800 rounded-lg p-3">
        <button
          onClick={start}
          disabled={isRunning || !connected}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
        >
          {isRunning ? "実行中..." : "デモを開始"}
        </button>
        <div className="text-right">
          <div className="text-[10px] text-gray-500">合計支払額</div>
          <div className="text-base font-mono font-bold text-green-400">
            ${totalSpent.toFixed(2)}
          </div>
        </div>
      </div>

      {logs.length === 0 && !isRunning && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {MPP_LANES.map(({ emoji, name, sub }) => (
              <div
                key={name}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center"
              >
                <div className="text-xl">{emoji}</div>
                <div className="text-sm font-semibold">{name}</div>
                <div className="text-xs text-gray-500">{sub}</div>
              </div>
            ))}
          </div>
          <ol className="text-xs text-gray-400 space-y-1.5">
            <li>
              <span className="text-blue-400 font-bold">1.</span> 買い手 → 売り手にAPIリクエスト
            </li>
            <li>
              <span className="text-yellow-400 font-bold">2.</span> 有料APIは 402 を返す
            </li>
            <li>
              <span className="text-purple-400 font-bold">3.</span>{" "}
              買い手がカードまたはクリプトを選択して決済
            </li>
            <li>
              <span className="text-purple-400 font-bold">4.</span> Seller → Stripe経由で課金
            </li>
            <li>
              <span className="text-green-400 font-bold">5.</span> 決済完了 → データ返却
            </li>
          </ol>
        </div>
      )}

      {(logs.length > 0 || isRunning) && (
        <SequenceDiagram
          steps={steps}
          lanes={MPP_LANES}
          isRunning={isRunning}
          onPaymentSelect={(type) => {
            fetch(`${API_URL}/select-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentType: type }),
            });
          }}
        />
      )}
    </>
  );
}
