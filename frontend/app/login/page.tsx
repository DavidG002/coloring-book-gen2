"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { BookOpen } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: "var(--canvas)", border: "1px solid var(--pencil-light)" }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--teal)", transform: "rotate(-5deg)" }}
          >
            <BookOpen size={15} color="white" />
          </div>
          <span className="font-display text-[19px]" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            coloring studio
          </span>
        </div>

        <h1 className="text-sm font-semibold mb-5" style={{ color: "var(--ink)" }}>
          Sign in to your account
        </h1>

        {error && (
          <p
            className="text-[13px] mb-4 rounded-lg px-3 py-2"
            style={{ background: "var(--coral-light)", color: "var(--coral-dark)" }}
          >
            {error}
          </p>
        )}

        <label className="block text-[11px] uppercase font-bold mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
          Email
        </label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4"
          style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)", color: "var(--ink)" }}
        />

        <label className="block text-[11px] uppercase font-bold mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm mb-6"
          style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)", color: "var(--ink)" }}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--teal)" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-[12px] mt-5 text-center" style={{ color: "var(--pencil)" }}>
          No signup here — ask David for an account.
        </p>
      </form>
    </div>
  );
}
