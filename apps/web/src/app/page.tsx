"use client";

import { useState, useEffect } from "react";
import type { LogEvent } from "@/components/types";
import { ModeTabs } from "@/components/ModeTabs";
import { X402Demo } from "@/components/X402Demo";
import { MppDemo } from "@/components/MppDemo";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export default function Home() {
  const [tab, setTab] = useState<"x402" | "mpp">("x402");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/events`);
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "connected") {
        setConnected(true);
        return;
      }
      window.dispatchEvent(new CustomEvent<LogEvent>("sse-log", { detail: d as LogEvent }));
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out both; }
      `}</style>

      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-1">エージェント決済デモ</h1>
        <p className="text-gray-500 text-sm">
          AIエージェントがAPI呼び出しごとに自動で決済を行います
        </p>
      </header>

      <div className="flex items-center gap-4 mb-4">
        <ModeTabs tab={tab} disabled={false} onTabChange={setTab} />
        <div className="ml-auto flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-400">{connected ? "接続中" : "未接続"}</span>
        </div>
      </div>

      {tab === "x402" ? <X402Demo connected={connected} /> : <MppDemo connected={connected} />}
    </main>
  );
}
