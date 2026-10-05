import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/session";
import { loginWithCloud } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { nextcloudUrl } from "@/server/auth/nextcloud";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { from } = await searchParams;
  const cloud = nextcloudUrl();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Anmelden</CardTitle>
        <CardDescription>
          Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link, mit dem Sie sich ohne Passwort anmelden.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {cloud ? (
          <>
            <form action={loginWithCloud}>
              <input type="hidden" name="from" value={from ?? ""} />
              <Button type="submit" variant="secondary" className="w-full">
                Mit CDU-Cloud anmelden ({new URL(cloud).host})
              </Button>
            </form>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="h-px flex-1 bg-neutral-200" /> oder per Anmeldelink <span className="h-px flex-1 bg-neutral-200" />
            </div>
          </>
        ) : null}
        <LoginForm from={from} />
      </CardContent>
    </Card>
  );
}
