"use client";

import { useState } from "react";

export function DataToggle({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-gray-500 hover:text-gray-300 underline"
      >
        {open ? "閉じる" : "詳細"}
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-black/50 rounded text-[11px] text-gray-400 overflow-x-auto max-h-40 overflow-y-auto text-left whitespace-pre">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </>
  );
}
