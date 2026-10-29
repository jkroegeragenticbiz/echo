import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { accounts, getDb, sessions, users, verificationTokens } from "@echo/db";

/**
 * Auth.js for the website: Sign in with Apple and email magic links. The iOS
 * app uses the same users/accounts tables through /api/auth/mobile/* and gets
 * a bearer token instead of a cookie (see lib/session.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Apple,
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in?check=email" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
}));
