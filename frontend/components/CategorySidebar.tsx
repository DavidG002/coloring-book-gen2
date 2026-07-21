"use client";

import { useState } from "react";

interface SidebarItem {
  id: string;
  label: string;
  complete: boolean;
}

export default function CategorySidebar({
  items,
  activeId,
  onSelect,
}: {
  items: SidebarItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="sticky top-6 self-start shrink-0 transition-all"
      style={{ width: collapsed ? "52px" : "190px" }}
    >
      <div
        className="rounded-lg border-[1.5px] overflow-hidden"
        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-center py-2.5 border-b-[1.5px]"
          style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>{"\u00AB"}</span>
        </button>
        <nav className="py-2">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm"
                style={{
                  color: isActive ? "var(--teal)" : "var(--pencil)",
                  fontWeight: isActive ? 600 : 400,
                }}
                title={collapsed ? item.label : undefined}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: item.complete ? "var(--teal)" : "var(--pencil-light)" }}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
