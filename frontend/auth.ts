import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";

// AUTH_SECRET is read automatically by NextAuth() from the environment,
// but we also need it directly below to mint the plain JWT FastAPI
// verifies, so it's read explicitly here too.
const secret = process.env.AUTH_SECRET;
if (!secret) {
  throw new Error(
    "AUTH_SECRET is not set. Add it to frontend/.env.local — it must be " +
      "the exact same value as AUTH_SECRET in backend/.env."
  );
}
const encodedSecret = new TextEncoder().encode(secret);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
      },
      // There is no public signup — every account was created ahead of
      // time via backend/create_user.py. This just checks what was typed
      // against the users table, via the backend (password hashing/
      // verification stays server-side, in services/auth.py).
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        const res = await fetch(`${API_BASE_URL}/auth/verify-credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return null;

        const user = await res.json();
        // NextAuth requires `id` to be a string.
        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          isAdmin: user.is_admin as boolean,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Runs on sign-in (user is defined) and on every subsequent request
      // (user is undefined then) — only copy fields across on sign-in.
      if (user) {
        token.userId = (user as { id: string }).id;
        token.isAdmin = (user as { isAdmin: boolean }).isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { id?: string; isAdmin?: boolean }).id =
          token.userId as string | undefined;
        (session.user as typeof session.user & { id?: string; isAdmin?: boolean }).isAdmin =
          token.isAdmin as boolean | undefined;
      }

      // Auth.js's own session cookie is encrypted (JWE) and FastAPI has no
      // reason to parse it. Instead, mint a separate, plain HS256 JWT here
      // — signed with the same AUTH_SECRET — that the frontend attaches
      // as `Authorization: Bearer <token>` on calls to FastAPI, which
      // verifies it with PyJWT (see backend/services/auth.py). Exposed on
      // the session object as `accessToken`.
      const accessToken = await new SignJWT({
        user_id: Number(token.userId),
        email: token.email,
        is_admin: token.isAdmin,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(encodedSecret);

      (session as typeof session & { accessToken?: string }).accessToken = accessToken;
      return session;
    },
  },
});
