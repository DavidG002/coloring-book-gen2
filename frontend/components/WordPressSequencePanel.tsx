"use client";
import { Send, ChevronLeft } from "lucide-react";
import SequencePanel from "./SequencePanel";
import WordPressPushPanel from "./WordPressPushPanel";
import type { StepId } from "./CategorySequenceShell";
export default function WordPressSequencePanel({
  categoryId,
  categoryName,
  onBackToFiles,
}: {
  categoryId: number;
  categoryName: string;
  onBackToFiles: (step: StepId) => void;
}) {
  return (
    <SequencePanel eyebrow="03 / PUBLISH" title="Push to WordPress" icon={<Send size={25} />}>
      <div className="px-6 pt-1 pb-4">
        <button
          onClick={() => onBackToFiles("publish")}
          className="inline-flex items-center gap-1 text-[11px] font-medium"
          style={{ color: "var(--pencil)" }}
        >
          <ChevronLeft size={12} /> Back to files
        </button>
      </div>
      <div className="px-6 pb-6">
        <WordPressPushPanel categoryId={categoryId} categoryName={categoryName} />
      </div>
    </SequencePanel>
  );
}