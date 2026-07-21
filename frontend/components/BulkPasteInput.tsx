"use client";

import { useState } from "react";

export default function BulkPasteInput({
  onAdd,
  placeholder,
}: {
  onAdd: (lines: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function handleConfirm() {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      onAdd(lines);
    }
    setText("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium"
        style={{ color: "var(--teal)" }}
      >
        Paste a list
      </button>
    );
  }

  return (
    <div
      className="rounded-md border-[1.5px] p-4 mb-3"
      style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
    >
      <p className="text-xs mb-2" style={{ color: "var(--pencil)" }}>
        One per line. Numbering, bullets, or extra punctuation from a pasted list are fine — blank lines are ignored.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={8}
        autoFocus
        className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-3"
        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!text.trim()}
          className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--teal)" }}
        >
          Add {text.split("\n").map((l) => l.trim()).filter(Boolean).length || ""} items
        </button>
        <button
          type="button"
          onClick={() => {
            setText("");
            setOpen(false);
          }}
          className="px-4 py-2 rounded-md text-sm font-medium"
          style={{ color: "var(--pencil)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
