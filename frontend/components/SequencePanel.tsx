"use client";

export default function SequencePanel({
  eyebrow,
  title,
  description,
  icon,
  children,
  footer,
  headerBorder = true,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerBorder?: boolean;
}) {
  return (
    <section className="rounded-[13px]" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
      <div
        className="flex items-start justify-between gap-5"
        style={{ padding: "28px 29px 24px", borderBottom: headerBorder ? "1px solid var(--pencil-light)" : "none" }}
      >
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            {eyebrow}
          </p>
          <h2
            className="font-display font-normal m-0 mt-2"
            style={{ fontSize: 30, letterSpacing: "-0.045em", color: "var(--ink)" }}
          >
            {title}
          </h2>
          {description && (
            <p className="text-xs leading-relaxed m-0 mt-2" style={{ maxWidth: 450, color: "var(--pencil)" }}>
              {description}
            </p>
          )}
        </div>
        {icon && <div style={{ color: "var(--teal)", flexShrink: 0 }}>{icon}</div>}
      </div>

      {children}

      {footer && (
        <div
          className="flex items-center justify-between gap-4"
          style={{ padding: "17px 29px", borderTop: "1px solid var(--pencil-light)" }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}
