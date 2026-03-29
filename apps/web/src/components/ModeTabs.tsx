"use client";

interface ModeTabsProps {
  tab: "x402" | "mpp";
  disabled: boolean;
  onTabChange: (tab: "x402" | "mpp") => void;
}

export function ModeTabs({ tab, disabled, onTabChange }: ModeTabsProps) {
  const cls = (active: boolean) =>
    `px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${active ? "bg-gray-900 border border-b-0 border-gray-700 text-white" : "bg-gray-950 text-gray-500 hover:text-gray-300"}`;

  return (
    <div className="flex gap-1 mb-4">
      <button
        onClick={() => !disabled && onTabChange("x402")}
        className={cls(tab === "x402")}
        disabled={disabled}
      >
        x402
      </button>
      <button
        onClick={() => !disabled && onTabChange("mpp")}
        className={cls(tab === "mpp")}
        disabled={disabled}
      >
        MPP（Stripe）
      </button>
    </div>
  );
}
