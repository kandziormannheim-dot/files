# Marken-Assets

Werden **nicht** im Repo gepflegt, sondern von der Hauptseite geladen
(`unfall/CLAUDE.md`, Abschnitt „Marken-Assets"):

```bash
cd unfall && ./scripts/fetch-brand.sh
```

Erwartete Dateien danach:

| Datei | Quelle |
| --- | --- |
| `logo.png` | cropped-rettinger_kollegen_logo_01.png |
| `favicon.png` | cropped-rettinger_kollegen_favicon-scaled-1-300x300.png |
| `vdi-vks-badge.png` | RK-VDI-Qualifield-Experts-VKS.png |

Aus der Agent-Session war sv-rettinger.de nicht erreichbar (Egress-Proxy).
Sobald die Dateien lokal geladen sind, dürfen sie eingecheckt werden — sie
sind Teil des Builds.
