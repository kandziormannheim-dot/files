import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import { db } from "@/server/db";
import { sendMail } from "@/server/mail/transport";
import { renderMail } from "@/server/mail/render";

const LINK_MINUTES = 15;

// Magic Link per E-Mail (SPEC.md Abschnitt 2). Nur bestehende, aktive Nutzer mit Login erhalten einen Link;
// neue Konten entstehen ausschließlich über die Nutzerverwaltung.
const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "E-Mail",
  maxAge: LINK_MINUTES * 60,
  normalizeIdentifier: (identifier) => identifier.trim().toLowerCase(),
  async sendVerificationRequest({ identifier, url }) {
    const user = await db.user.findUnique({ where: { email: identifier } });
    const { subject, text, html } = await renderMail("anmeldung.mail", {
      empfaenger: { name: user?.name ?? "" },
      anmeldung: { link: url, gueltigMinuten: LINK_MINUTES },
    });
    // Anmeldelinks sofort senden (nicht über die Queue), damit Fehler direkt sichtbar werden
    await sendMail({ to: identifier, subject, text, html });
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  session: { strategy: "database", maxAge: 14 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers: [emailProvider],
  pages: { signIn: "/login", verifyRequest: "/login/check", error: "/login/error" },
  callbacks: {
    async signIn({ user, email }) {
      const address = user.email?.toLowerCase();
      const known = address ? await db.user.findUnique({ where: { email: address } }) : null;
      const allowed = !!known && known.active && known.loginEnabled;
      // Unbekannte Adressen bekommen dieselbe Rückmeldung wie bekannte, aber keinen Link.
      if (email?.verificationRequest) return allowed ? true : "/login/check";
      return allowed;
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
