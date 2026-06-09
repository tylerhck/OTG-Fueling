import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getGeoFromIp, getClientIp } from "@/lib/geo";
import { headers } from "next/headers";
import { randomBytes } from "crypto";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const limit = rateLimit(`signin:${email}`, 10, 15 * 60 * 1000);
        if (!limit.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        // Track session location (non-blocking — won't break login if it fails)
        try {
          const hdrs = await headers();
          const ip = getClientIp(hdrs);
          const userAgent = hdrs.get("user-agent") || null;
          const geo = await getGeoFromIp(ip);

          const sessionToken = randomBytes(32).toString("hex");
          await prisma.activeSession.create({
            data: {
              userId: user.id,
              token: sessionToken,
              ipAddress: ip,
              city: geo.city,
              region: geo.region,
              country: geo.country,
              userAgent,
            },
          });
        } catch (err) {
          // Never block login — just log the error
          console.error("[AUTH] Session tracking failed:", err);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
});
