"use client";

import { useRef, useEffect } from "react";
import type { Step, LaneConfig, Actor } from "./types";
import { COLORS } from "./types";
import { DataToggle } from "./DataToggle";

function buildLaneX(lanes: LaneConfig[]): Record<Actor, number> {
  const result: Partial<Record<Actor, number>> = {};
  const count = lanes.length;
  lanes.forEach((lane, i) => {
    result[lane.key] = ((i + 0.5) / count) * 100;
  });
  return result as Record<Actor, number>;
}

function Lifelines({ laneX }: { laneX: Record<string, number> }) {
  return (
    <>
      {Object.values(laneX).map((x, i) => (
        <div key={i} className="absolute top-0 bottom-0" style={{ left: `${x}%` }}>
          <div className="w-px h-full bg-gray-800" />
        </div>
      ))}
    </>
  );
}

function StepRow({
  step,
  index,
  laneX,
  onPaymentSelect,
}: {
  step: Step;
  index: number;
  laneX: Record<string, number>;
  onPaymentSelect?: (type: "card" | "crypto") => void;
}) {
  const c = COLORS[step.color] || COLORS.gray;
  const fromX = laneX[step.from] ?? 12.5;
  const toX = laneX[step.to] ?? 37.5;

  if (step.isPaymentSelect) {
    return (
      <div className="relative animate-fadeIn" style={{ animationDelay: "0ms" }}>
        <div className="absolute inset-0 pointer-events-none">
          <Lifelines laneX={laneX} />
        </div>
        <div className="relative z-10 py-3">
          <div className="absolute" style={{ left: `${fromX}%` }}>
            <div className="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="text-xs text-yellow-300 mb-2">{step.label}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => onPaymentSelect?.("card")}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs text-white font-medium transition-colors"
                >
                  💳 カード決済
                </button>
                <button
                  onClick={() => onPaymentSelect?.("crypto")}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-xs text-white font-medium transition-colors"
                >
                  🪙 クリプト決済
                </button>
              </div>
            </div>
          </div>
          <div className="h-16" />
        </div>
      </div>
    );
  }

  if (step.isSystem) {
    return (
      <div className="relative animate-fadeIn" style={{ animationDelay: "0ms" }}>
        <div className="absolute inset-0 pointer-events-none">
          <Lifelines laneX={laneX} />
        </div>
        <div className="relative z-10 py-2">
          <div className="absolute" style={{ left: `${fromX}%` }}>
            <div className={`px-3 py-1.5 rounded-lg ${c.bg} border ${c.border} whitespace-nowrap`}>
              <span className={`text-xs ${c.text}`}>{step.label}</span>
            </div>
          </div>
          <div className="h-8" />
        </div>
      </div>
    );
  }

  const goingRight = toX > fromX;
  const leftPct = Math.min(fromX, toX);
  const widthPct = Math.abs(toX - fromX);

  return (
    <div className="relative animate-fadeIn" style={{ animationDelay: "0ms" }}>
      <div className="absolute inset-0 pointer-events-none">
        <Lifelines laneX={laneX} />
      </div>
      <div className="relative z-10">
        <div className="relative py-1" style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}>
          <div className={goingRight ? "text-left" : "text-right"}>
            <div
              className={`inline-block px-2 py-1 rounded ${c.bg} border ${c.border} max-w-[280px]`}
            >
              <div className={`text-[11px] font-semibold ${c.text} leading-tight`}>
                {step.label}
              </div>
              {step.detail && (
                <div className="text-[10px] text-gray-500 leading-tight mt-0.5 break-all">
                  {step.detail}
                </div>
              )}
              {(step.txHash ?? step.data) !== undefined && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {step.txHash && (
                    <a
                      href={`https://sepolia.basescan.org/tx/${step.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Basescan ↗
                    </a>
                  )}
                  {step.data != null && <DataToggle data={step.data} />}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="h-5 relative">
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <marker
                id={`a-${step.id}`}
                markerWidth="7"
                markerHeight="5"
                refX="7"
                refY="2.5"
                orient="auto"
              >
                <path d="M0,0 L7,2.5 L0,5" fill={c.line} />
              </marker>
            </defs>
            <line
              x1={`${fromX}%`}
              y1="50%"
              x2={`${toX}%`}
              y2="50%"
              stroke={c.line}
              strokeWidth="2"
              strokeDasharray={goingRight ? "none" : "6,4"}
              markerEnd={`url(#a-${step.id})`}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function SequenceDiagram({
  steps,
  lanes,
  isRunning,
  onPaymentSelect,
}: {
  steps: Step[];
  lanes: LaneConfig[];
  isRunning: boolean;
  onPaymentSelect?: (type: "card" | "crypto") => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneX = buildLaneX(lanes);

  const prevLength = useRef(0);
  useEffect(() => {
    if (steps.length > prevLength.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 400);
      prevLength.current = steps.length;
      return () => clearTimeout(timer);
    }
    prevLength.current = steps.length;
  }, [steps.length]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <div
        className={`grid border-b border-gray-700 bg-gray-900 sticky top-0 z-20`}
        style={{ gridTemplateColumns: `repeat(${lanes.length}, 1fr)` }}
      >
        {lanes.map(({ emoji, name, sub }) => (
          <div key={name} className="py-2.5 text-center">
            <div className="text-base leading-none">{emoji}</div>
            <div className="text-xs font-semibold mt-1">{name}</div>
            <div className="text-[10px] text-gray-500">{sub}</div>
          </div>
        ))}
      </div>
      <div className="max-h-[600px] overflow-y-auto py-2">
        {steps.length === 0 && isRunning && (
          <div className="text-center text-gray-500 py-10 text-sm">処理を開始しています...</div>
        )}
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            laneX={laneX}
            onPaymentSelect={onPaymentSelect}
          />
        ))}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
