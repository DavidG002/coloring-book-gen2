"use client";
export default function LanguagePills({
  languages,
  selected,
  onSelect,
}: {
  languages: string[];
  selected: string;
  onSelect: (lang: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {languages.map((lang) => {
        const active = selected === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => onSelect(active ? "" : lang)}
            className="inline-flex items-center justify-center rounded-md text-[10px] font-black uppercase"
            style={{
              width: 36,
              height: 28,
              background: active ? "var(--teal)" : "var(--teal-tint)",
              color: active ? "white" : "var(--teal-dark)",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}