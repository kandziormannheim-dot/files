/**
 * God's Eye View als Dienst starten.
 *
 * Upstream (bilawalsidhu/gods-eye-view) kennt zwei Startwege: `npm run dev`
 * für die Entwicklung und `npm run preview` für die gebauten Dateien. Beide
 * bringen dieselbe Middleware mit — die Datenkanäle unter /api/ laufen
 * serverseitig, damit die Schlüssel den Rechner nie verlassen. Ohne sie wäre
 * die gebaute Oberfläche nur eine leere Hülle.
 *
 * Warum dann nicht einfach `npm run preview`? Weil dessen Vorgaben aus der
 * Projektkonfiguration kommen: gelauscht wird auf localhost, und erlaubt sind
 * nur die Hostnamen localhost, 127.0.0.1 und *.local. Hinter einer Subdomain
 * antwortet der Vorschau-Server deshalb auf *jede* Anfrage mit
 * »Blocked request. This host is not allowed« (Schutz gegen DNS-Rebinding).
 * Der naheliegende Ausweg — HOST=0.0.0.0, das die Prüfung ganz abschaltet —
 * würde den Dienst zugleich auf allen Netzschnittstellen öffnen und damit am
 * Reverse-Proxy und am Zugangsschutz vorbei erreichbar machen.
 *
 * Also hier: lauschen ausschließlich auf 127.0.0.1, und als erlaubter
 * Hostname genau die eingerichtete Subdomain. Beides bleibt eng, der
 * Rebinding-Schutz bleibt wirksam.
 *
 * Erwartete Umgebung (setzt godview-app/dienst.sh):
 *   GODVIEW_PORT       Port, auf dem gelauscht wird (Vorgabe 4180)
 *   GODVIEW_HOST       Lausch-Adresse (Vorgabe 127.0.0.1)
 *   GODVIEW_HOSTNAMEN  erlaubte Host-Köpfe, kommagetrennt (Pflicht)
 *
 * Die Schlüssel selbst stehen in der .env neben dieser Datei; Vite liest sie
 * beim Laden der Projektkonfiguration ein.
 */

import { preview } from 'vite';

const port = Number.parseInt(process.env.GODVIEW_PORT || '4180', 10);
const host = process.env.GODVIEW_HOST || '127.0.0.1';
const hostnamen = (process.env.GODVIEW_HOSTNAMEN || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`GODVIEW_PORT ist keine brauchbare Portnummer: ${process.env.GODVIEW_PORT}`);
  process.exit(1);
}
if (hostnamen.length === 0) {
  console.error(
    'GODVIEW_HOSTNAMEN ist leer — ohne erlaubten Hostnamen würde der Dienst jede Anfrage ' +
      'über die Subdomain mit 403 abweisen. Erwartet wird z. B. "godview.kandzior.de".',
  );
  process.exit(1);
}

const server = await preview({
  root: process.cwd(),
  preview: { host, port, strictPort: true, allowedHosts: hostnamen },
});

console.log(
  `[${new Date().toISOString()}] God's Eye View lauscht auf http://${host}:${port} ` +
    `für ${hostnamen.join(', ')}`,
);

// Ordentlich beenden, damit dienst.sh stop den Port sofort wieder freigibt.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    const fertig = () => process.exit(0);
    if (typeof server.close === 'function') {
      Promise.resolve(server.close()).then(fertig, fertig);
    } else {
      server.httpServer.close(fertig);
    }
  });
}
