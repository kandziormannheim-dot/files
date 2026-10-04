import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import { db } from "@/server/db";
import { sendMail } from "@/server/mail/transport";
import { OV_DEFAULTS, appUrl } from "@/server/ov";
import { renderMailTemplate } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";

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
    const { source } = await getTemplateSource("anmeldung.mail");
    const mail = renderMailTemplate(source, {
      ov: { ...OV_DEFAULTS, appUrl: appUrl() },
      empfaenger: { name: user?.name ?? "" },
      anmeldung: { link: url, gueltigMinuten: LINK_MINUTES },
    });
    await sendMail({ to: identifier, ...mail });
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
