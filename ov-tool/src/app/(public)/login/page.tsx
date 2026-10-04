import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { from } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Anmelden</CardTitle>
        <CardDescription>
          Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link, mit dem Sie sich ohne Passwort anmelden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm from={from} />
      </CardContent>
    </Card>
  );
}
