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
      {languages.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onSelect(selected === lang ? "" : lang)}
          className="px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] uppercase"
          style={
            selected === lang
              ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
              : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
          }
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
