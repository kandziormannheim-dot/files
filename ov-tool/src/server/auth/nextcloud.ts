import type { OAuthConfig } from "next-auth/providers";

// Gemeinsamer Login über die Nextcloud des OV (cloud.cdu-sf.de) mit der eingebauten OAuth-2.0-App von Nextcloud.
// Einrichtung: Nextcloud → Verwaltungseinstellungen → Sicherheit → OAuth-2.0-Clients,
// Weiterleitungs-URL https://management.cdu-sf.de/api/auth/callback/nextcloud. Client-ID/Geheimnis nur in der .env.

type NextcloudProfile = { ocs: { data: { id: string; email: string | null; displayname?: string; "display-name"?: string } } };

export function nextcloudUrl(): string | null {
  const url = process.env.NEXTCLOUD_URL?.trim().replace(/\/+$/, "");
  return url && process.env.NEXTCLOUD_CLIENT_ID && process.env.NEXTCLOUD_CLIENT_SECRET ? url : null;
}

export function nextcloudProvider(): OAuthConfig<NextcloudProfile> | null {
  const base = nextcloudUrl();
  if (!base) return null;
  return {
    id: "nextcloud",
    name: "CDU-Cloud",
    type: "oauth",
    clientId: process.env.NEXTCLOUD_CLIENT_ID,
    clientSecret: process.env.NEXTCLOUD_CLIENT_SECRET,
    // Nextcloud kennt weder OIDC-Discovery noch PKCE; Schutz über den state-Parameter.
    checks: ["state"],
    authorization: { url: `${base}/index.php/apps/oauth2/authorize`, params: { scope: "" } },
    token: `${base}/index.php/apps/oauth2/api/v1/token`,
    client: { token_endpoint_auth_method: "client_secret_post" },
    userinfo: {
      url: `${base}/ocs/v2.php/cloud/user?format=json`,
      async request({ tokens }: { tokens: { access_token?: string } }) {
        const res = await fetch(`${base}/ocs/v2.php/cloud/user?format=json`, {
          headers: { Authorization: `Bearer ${tokens.access_token}`, "OCS-APIRequest": "true", Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Nextcloud-Profil nicht abrufbar (HTTP ${res.status})`);
        return (await res.json()) as NextcloudProfile;
      },
    },
    profile(p) {
      const d = p.ocs.data;
      return { id: d.id, email: d.email?.trim().toLowerCase() ?? null, name: d.displayname ?? d["display-name"] ?? d.id };
    },
    // Die Cloud gehört dem OV und bestätigt die Adresse; verknüpft wird nur mit bereits angelegten Nutzern (signIn-Callback).
    allowDangerousEmailAccountLinking: true,
  };
}
