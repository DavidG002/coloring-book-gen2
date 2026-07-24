"use client";

import { useRef } from "react";

export interface TemplateToken {
  key: string;       // e.g. "category" -> inserts {category}
  label: string;      // e.g. "Category"
}

export default function TemplateField({
  label,
  value,
  onChange,
  tokens,
  previewValues,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tokens: TemplateToken[];
  previewValues: Record<string, string>;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function insertToken(tokenKey: string) {
    const input = inputRef.current;
    const insertText = `{${tokenKey}}`;

    if (!input) {
      onChange(value + insertText);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = value.slice(0, start) + insertText + value.slice(end);
    onChange(next);

    // Restore focus and place cursor right after the inserted token
    requestAnimationFrame(() => {
      input.focus();
      const cursorPos = start + insertText.length;
      input.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function buildPreview(): string {
    let preview = value;
    for (const token of tokens) {
      const sample = previewValues[token.key] ?? `{${token.key}}`;
      preview = preview.split(`{${token.key}}`).join(sample);
    }
    return preview;
  }

  const preview = buildPreview();

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          {tokens.map((token) => (
            <button
              key={token.key}
              type="button"
              onClick={() => insertToken(token.key)}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ background: "var(--paper)", color: "var(--teal)", border: "1px solid var(--pencil-light)" }}
              title={`Insert {${token.key}}`}
            >
              + {token.label}
            </button>
          ))}
        </div>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm font-mono"
        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
      />
      {value && (
        <p className="mt-1.5 text-xs truncate" style={{ color: "var(--pencil)" }}>
          Preview: <span style={{ color: "var(--ink)" }}>{preview || "\u2014"}</span>
        </p>
      )}
    </div>
  );
}
