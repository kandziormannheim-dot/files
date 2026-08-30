# Obsidian-Vault und OpenClaw

Damit der Agent auf `clawlive.kandzior.cc` dieselben Notizen sieht wie Obsidian
auf dem Windows-Rechner — und hineinschreiben kann.

## Warum über GitHub und nicht direkt

Es sind drei getrennte Rechner ohne gemeinsame Platte:

```
   Windows-Laptop            GitHub                  Hostinger-VPS
   Obsidian                  obsidian-vault          OpenClaw
   C:\Obsidian\...     <-->  (privat)         <-->   ~/obsidian-vault
   Vault-Sync.ps1            die Brücke              vault-sync.sh
   alle 15 Minuten                                   alle 15 Minuten
```

Ein direkter Draht — der Server greift in den Laptop hinein, oder umgekehrt —
gibt es nicht und sollte es auch nicht geben: dafür müsste der Laptop dauerhaft
erreichbar und offen sein. Das Repository in der Mitte löst dasselbe Problem
besser. Es ist immer erreichbar, es merkt sich jeden Stand, und wenn zwei Seiten
gleichzeitig schreiben, fällt das auf, statt still eine Fassung zu überschreiben.

Der Weg ist auch der einzige, über den *diese* Sitzung an die Notizen käme:
Claude Code läuft hier in einem eigenen Container, dessen Netzzugang auf wenige
Ziele beschränkt ist — `clawlive.kandzior.cc` gehört nicht dazu, ein Aufruf wird
vom Egress-Proxy abgewiesen. Über das Repository geht es trotzdem, weil GitHub
erlaubt ist.

**Echtzeit ist das nicht.** Eine Notiz, die auf dem Laptop entsteht, liegt im
schlechtesten Fall 30 Minuten später beim Agenten: bis zu 15 Minuten, bis der
Laptop pusht, und bis zu 15 weitere, bis der Server holt. Wer schneller sein
will, ruft den Abgleich von Hand auf — auf beiden Seiten.

## Einrichten (auf dem Server, einmalig)

Als der Benutzer anmelden, unter dem OpenClaw läuft — nicht als `root`, sonst
liegen Schlüssel und Timer beim falschen Konto:

```bash
curl -fsSLO https://raw.githubusercontent.com/kandziormannheim-dot/files/main/docs/obsidian/vault-sync.sh
chmod +x vault-sync.sh
./vault-sync.sh einrichten --workspace ~/.openclaw/workspace
```

Der erste Lauf legt einen SSH-Schlüssel an und hält dann an, weil der Server
noch nicht an das private Repository darf. Er zeigt den öffentlichen Schlüssel
und was damit zu tun ist:

1. Schlüssel kopieren (die Zeile, die mit `ssh-ed25519` beginnt).
2. Auf GitHub: `obsidian-vault` → **Settings** → **Deploy keys** → **Add deploy
   key**. Titel frei wählbar, Schlüssel einfügen, und **„Allow write access"
   ankreuzen** — ohne das darf der Server nur lesen, und jeder Push scheitert.
3. Denselben Befehl noch einmal aufrufen.

Dann klont er die Vault, richtet den Zeitplan ein und macht einen ersten
Abgleich. `--workspace` ist der Ordner, in dem OpenClaw arbeitet; dort entsteht
die Verknüpfung `obsidian` auf die Vault. Passt der Pfad nicht, einfach den
richtigen angeben — das Skript rät nur an den üblichen Stellen.

Ein Deploy-Key ist einem Zugangstoken vorzuziehen: er gilt für dieses eine
Repository, nicht für das ganze Konto, und liegt nicht im Klartext in einer
Konfigurationsdatei. Wer trotzdem lieber HTTPS nimmt, hängt
`--remote https://github.com/kandziormannheim-dot/obsidian-vault.git` an und
hinterlegt die Zugangsdaten im Git-Credential-Helper.

## Was jeder Lauf tut

Ein systemd-Timer (`obsidian-vault-sync.timer`, ersatzweise ein Cron-Eintrag)
ruft alle 15 Minuten `vault-sync.sh abgleich` auf. Der Ablauf ist derselbe wie
auf dem Windows-Rechner:

1. Änderungen einchecken — falls es welche gibt.
2. Vom Remote holen, die eigenen Commits per Rebase daraufsetzen, pushen.
3. Eine Zeile ins Protokoll schreiben.

Protokoll: `~/.local/state/obsidian-vault-sync/sync.log`

Ist das Netz weg, wird nur lokal eingecheckt und der Push beim nächsten Lauf
nachgeholt. Das ist kein Fehler. Läuft ein Abgleich noch, während der Timer den
nächsten startet, geht der zweite kommentarlos wieder — kein Rebase auf einen
Rebase.

Was der Agent schreibt, zeichnet als `OpenClaw <openclaw@…>`, was vom Laptop
kommt, unter dem dortigen Namen. In `git log` ist damit jederzeit erkennbar,
welche Seite eine Notiz angefasst hat.

## Drei Schreiber, ein Repository

Bisher war es einer. Jetzt schreiben Laptop, Server-Agent und gelegentlich eine
Claude-Code-Sitzung in dieselbe Historie. Git führt das zusammen, solange nicht
zwei Seiten **dieselbe Datei** zwischen zwei Abgleichen ändern. Passiert das,
bricht der Abgleich ab, ohne etwas zu überschreiben, und meldet `FEHLER` ins
Protokoll — der lokale Stand bleibt, wie er war.

Das lässt sich weitgehend vermeiden, indem jede Seite ihren eigenen Bereich hat.
Bewährt: der Agent legt Neues ausschließlich in `00_Posteingang/openclaw/` ab
und ändert bestehende Notizen nur, wenn er ausdrücklich dazu aufgefordert wird.
Dann kollidiert er praktisch nie mit dem, was gerade auf dem Laptop entsteht.

Kommt es doch dazu, zeigt `./vault-sync.sh pruefen` „auseinandergelaufen", und
die Auflösung geschieht von Hand auf der Seite, die den Konflikt gemeldet hat:

```bash
cd ~/obsidian-vault
git pull --rebase origin main
# Konfliktstellen in den betroffenen Notizen bereinigen, dann:
git add -A && git rebase --continue && git push origin main
```

Danach übernimmt der Timer wieder von allein.

## Was OpenClaw wissen muss

Der Agent findet die Vault nicht von selbst. Dieser Absatz gehört in seine
Anweisungen — Wortlaut anpassen, der Inhalt zählt:

> Die Obsidian-Vault liegt unter `~/obsidian-vault` (im Arbeitsverzeichnis als
> `obsidian` verknüpft). Es sind gewöhnliche Markdown-Dateien; Links stehen als
> `[[Wikilinks]]`. Neue Notizen kommen nach `00_Posteingang/openclaw/`,
> benannt `JJJJ-MM-TT-thema.md`. Bestehende Notizen nur ändern, wenn ich es
> ausdrücklich sage. Nichts committen oder pushen — das erledigt alle 15 Minuten
> `vault-sync.sh`. Die Ordnerstruktur ist in `docs/obsidian/README.md` des
> Repositorys `kandziormannheim-dot/files` beschrieben.

Der letzte Punkt ist wichtig: schreibt der Agent selbst Commits, laufen zwei
Prozesse im selben Repository, und die Wahrscheinlichkeit eines abgebrochenen
Rebase steigt ohne Not. Dateien anlegen genügt, der Rest passiert von allein.

## Zustand ansehen

```bash
./vault-sync.sh pruefen
```

Zeigt Ordner, Anzahl Notizen, Remote, offene Änderungen, den Stand gegenüber
`origin/main`, ob der Timer läuft, ob die Verknüpfung ins Arbeitsverzeichnis
steht, und die letzten Protokollzeilen. Ändert nichts.

Nützlich daneben:

```bash
systemctl --user list-timers obsidian-vault-sync.timer   # wann der nächste Lauf ansteht
systemctl --user start obsidian-vault-sync.service       # sofort abgleichen
tail -f ~/.local/state/obsidian-vault-sync/sync.log      # zusehen
```

## Wenn etwas klemmt

| Meldung | Ursache und Abhilfe |
| --- | --- |
| `Deploy-Key noch nicht hinterlegt` | Schritt 2 der Einrichtung fehlt, oder „Allow write access" ist nicht angekreuzt. |
| `Push endgültig fehlgeschlagen` | Meist derselbe Grund: der Schlüssel darf lesen, aber nicht schreiben. |
| `Konflikt beim Zusammenführen` | Zwei Seiten haben dieselbe Notiz geändert. Auflösen wie oben; es geht nichts verloren. |
| `Remote nicht erreichbar` | Nur eine Warnung. Der nächste Lauf holt den Push nach. |
| Timer läuft nicht nach Neustart | `loginctl enable-linger <benutzer>` — sonst ruhen Nutzer-Timer, solange niemand angemeldet ist. |
| Agent sieht die Notizen nicht | Läuft OpenClaw in Docker, muss die Vault als Volume hinein: `-v ~/obsidian-vault:/workspace/obsidian`. Eine Verknüpfung auf dem Wirt reicht dem Container nicht. |

## Zurückdrehen

```bash
./vault-sync.sh entfernen
```

Nimmt Timer beziehungsweise Cron-Eintrag weg. Die Vault unter `~/obsidian-vault`
bleibt samt Historie liegen; wer auch die los sein will, löscht den Ordner. Auf
dem Laptop und auf GitHub ändert sich dadurch nichts. Den Deploy-Key auf GitHub
entfernt man in denselben Einstellungen, in denen er eingetragen wurde.
