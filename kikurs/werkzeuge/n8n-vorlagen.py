#!/usr/bin/env python3
"""Erzeugt die n8n-Vorlagen unter public/vorlagen/.

Die IDs sind feste, aus dem Namen abgeleitete UUIDs, damit ein erneuter Lauf
keine Diffs erzeugt. Aufruf: python3 kikurs/werkzeuge/n8n-vorlagen.py
Geprüft werden die Vorlagen mit werkzeuge/n8n-pruefen.cjs gegen eine lokale
n8n-Installation (siehe docs/kikurs/README.md).
"""
import json, os, uuid

ZIEL = os.path.join(os.path.dirname(__file__), '..', 'public', 'vorlagen')
MODELL = {"__rl": True, "mode": "list", "value": "claude-sonnet-5", "cachedResultName": "Claude Sonnet 5"}


def uid(*teile):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'kikurs/' + '/'.join(teile)))


def knoten(wf, name, typ, version, x, y, parameter, **extra):
    k = {"parameters": parameter, "id": uid(wf, name), "name": name, "type": typ,
         "typeVersion": version, "position": [x, y]}
    k.update(extra)
    return k


def haupt(*kette):
    """Verbindungen main: [(von, ausgang, nach), …]."""
    c = {}
    for von, ausgang, nach in kette:
        aus = c.setdefault(von, {}).setdefault("main", [])
        while len(aus) <= ausgang:
            aus.append([])
        aus[ausgang].append({"node": nach, "type": "main", "index": 0})
    return c


def ai(c, von, art, nach):
    c.setdefault(von, {})[art] = [[{"node": nach, "type": art, "index": 0}]]


def bedingung(wf, name, links, operator, rechts=None):
    op = {"type": "string" if operator in ("equals", "notEquals") else "boolean", "operation": operator}
    if op["type"] == "boolean":
        op["singleValue"] = True
    b = {"id": uid(wf, name, "bedingung"), "leftValue": links, "operator": op}
    b["rightValue"] = rechts if rechts is not None else ""
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                           "conditions": [b], "combinator": "and"}, "looseTypeValidation": True, "options": {}}


def mail(betreff, text):
    return {"fromEmail": "ki-werkstatt@example.org", "toEmail": "du@example.org", "subject": betreff,
            "emailFormat": "text", "text": text, "options": {"appendAttribution": False}}


def notiz(wf, name, x, y, text, breite=420, hoehe=260):
    return knoten(wf, name, "n8n-nodes-base.stickyNote", 1, x, y,
                  {"content": text, "width": breite, "height": hoehe, "color": 6})


def workflow(name, nodes, connections):
    return {"name": name, "nodes": nodes, "connections": connections, "pinData": {},
            "settings": {"executionOrder": "v1"}, "active": False, "meta": {"templateCredsSetupCompleted": False},
            "tags": []}


vorlagen = {}

# --- 1 Impediment-Melder (Modul 4, ohne KI)
w = "impediment"
feld_was, feld_seit, feld_stark = "Was blockiert dich?", "Seit wann?", "Wie stark?"
vorlagen["impediment-melder"] = workflow("KI-Werkstatt · Impediment-Melder", [
    notiz(w, "Anleitung", -80, -300,
          "## Impediment-Melder (Modul 4)\n1. Empfänger in **Nachricht an Scrum Master** eintragen und SMTP-Credential wählen (oder Knoten durch Teams/Slack ersetzen).\n2. **Test workflow** klicken, Formular ausfüllen.\n3. Oben rechts **Active** einschalten und die Produktions-URL des Formulars ans Team geben."),
    knoten(w, "Formular: Hindernis melden", "n8n-nodes-base.formTrigger", 2.2, 0, 0, {
        "formTitle": "Hindernis melden",
        "formDescription": "Was hält dich gerade auf? Die Meldung geht an den Scrum Master.",
        "formFields": {"values": [
            {"fieldLabel": feld_was, "fieldType": "textarea", "requiredField": True},
            {"fieldLabel": feld_seit, "placeholder": "z. B. seit Montag"},
            {"fieldLabel": feld_stark, "fieldType": "dropdown", "requiredField": True,
             "fieldOptions": {"values": [{"option": "1 – nervt"}, {"option": "2 – bremst"}, {"option": "3 – blockiert"}]}},
        ]},
        "options": {"appendAttribution": False, "respondWithOptions": {"values": {"formSubmittedText": "Danke! Deine Meldung ist angekommen."}}},
    }, webhookId=uid(w, "webhook")),
    knoten(w, "Stark?", "n8n-nodes-base.if", 2, 260, 0,
           bedingung(w, "Stark?", "={{ $json['" + feld_stark + "'] }}", "equals", "3 – blockiert")),
    knoten(w, "Nachricht an Scrum Master", "n8n-nodes-base.emailSend", 2.1, 520, -100,
           mail("=Starkes Hindernis: {{ $json['" + feld_was + "'].slice(0, 60) }}",
                "=Neue Meldung (Stärke 3)\n\nWas: {{ $json['" + feld_was + "'] }}\nSeit: {{ $json['" + feld_seit + "'] }}\nZeit: {{ $json.submittedAt }}")),
], haupt(("Formular: Hindernis melden", 0, "Stark?"), ("Stark?", 0, "Nachricht an Scrum Master")))

# --- 2 Retro-Radar: einordnen (Modul 5)
w = "retro-einordnen"
PROMPT = ("Du ordnest anonymes Retrospektiven-Feedback eines Scrum-Teams ein.\n"
          "Themen: Zusammenarbeit, Prozess, Technik, Stakeholder, Arbeitslast, Sonstiges.\n"
          "stimmung: -1 negativ, 0 neutral, 1 positiv.\n"
          "kernaussage: höchstens 12 Wörter, neutral formuliert, ohne Namen.\n"
          "sicher: false, wenn das Feedback mehrdeutig ist.\n\n"
          "Feedback:\nGut: {{ $json['Was lief gut?'] }}\nGebremst: {{ $json['Was hat gebremst?'] }}\nIdee: {{ $json['Idee für den nächsten Sprint'] }}")
c = haupt(("Formular: Retro-Feedback", 0, "KI: einordnen"), ("KI: einordnen", 0, "Speichern"), ("Speichern", 0, "Unsicher?"),
          ("Unsicher?", 0, "Zur Prüfung an dich"))
ai(c, "Chat Model", "ai_languageModel", "KI: einordnen")
ai(c, "JSON-Format", "ai_outputParser", "KI: einordnen")
vorlagen["retro-radar-einordnen"] = workflow("KI-Werkstatt · Retro-Radar: einordnen", [
    notiz(w, "Anleitung", -80, -340,
          "## Retro-Radar: einordnen (Modul 5)\n1. Im **Chat Model** euer Modell-Credential wählen (jedes Chat-Model-Knoten-Paar geht, z. B. OpenAI oder Gemini statt Anthropic).\n2. Unter **Data Tables** eine Tabelle *retro_feedback* mit den Spalten sprint, thema, stimmung, kernaussage, sicher, original anlegen und in **Speichern** auswählen.\n3. Empfänger in **Zur Prüfung an dich** eintragen.\n4. Mit 20 Test-Einträgen die Trefferquote messen.", 460, 300),
    knoten(w, "Formular: Retro-Feedback", "n8n-nodes-base.formTrigger", 2.2, 0, 0, {
        "formTitle": "Retro-Feedback (anonym)",
        "formDescription": "Bitte keine Namen nennen. Die Antworten werden vor der Retro ausgewertet.",
        "formFields": {"values": [
            {"fieldLabel": "Sprint", "placeholder": "z. B. 14", "requiredField": True},
            {"fieldLabel": "Was lief gut?", "fieldType": "textarea"},
            {"fieldLabel": "Was hat gebremst?", "fieldType": "textarea"},
            {"fieldLabel": "Idee für den nächsten Sprint", "fieldType": "textarea"},
        ]},
        "options": {"appendAttribution": False},
    }, webhookId=uid(w, "webhook")),
    knoten(w, "KI: einordnen", "@n8n/n8n-nodes-langchain.chainLlm", 1.5, 260, 0,
           {"promptType": "define", "text": "=" + PROMPT, "hasOutputParser": True}),
    knoten(w, "Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.3, 200, 220,
           {"model": MODELL, "options": {"temperature": 0.2}}),
    knoten(w, "JSON-Format", "@n8n/n8n-nodes-langchain.outputParserStructured", 1.2, 380, 220,
           {"jsonSchemaExample": json.dumps({"thema": "Prozess", "stimmung": -1, "kernaussage": "Reviews dauern zu lange", "sicher": True}, ensure_ascii=False, indent=2)}),
    knoten(w, "Speichern", "n8n-nodes-base.dataTable", 1, 620, 0, {
        "dataTableId": {"__rl": True, "mode": "list", "value": ""},
        "columns": {"mappingMode": "defineBelow", "value": {
            "sprint": "={{ $('Formular: Retro-Feedback').item.json.Sprint }}",
            "thema": "={{ $json.output.thema }}",
            "stimmung": "={{ $json.output.stimmung }}",
            "kernaussage": "={{ $json.output.kernaussage }}",
            "sicher": "={{ $json.output.sicher }}",
            "original": "={{ JSON.stringify($('Formular: Retro-Feedback').item.json) }}"},
            "matchingColumns": [], "schema": [], "attemptToConvertTypes": False, "convertFieldsToString": False},
        "options": {}}),
    knoten(w, "Unsicher?", "n8n-nodes-base.if", 2, 860, 0,
           bedingung(w, "Unsicher?", "={{ $('KI: einordnen').item.json.output.sicher }}", "false")),
    knoten(w, "Zur Prüfung an dich", "n8n-nodes-base.emailSend", 2.1, 1100, -100,
           mail("Retro-Radar: bitte kurz prüfen",
                "=Die KI war sich bei diesem Feedback unsicher:\n\n{{ JSON.stringify($('Formular: Retro-Feedback').item.json, null, 2) }}\n\nVorschlag: {{ $('KI: einordnen').item.json.output.thema }} – {{ $('KI: einordnen').item.json.output.kernaussage }}")),
], c)

# --- 3 Retro-Radar: Zusammenfassung (Modul 5)
w = "retro-zusammenfassung"
c = haupt(("Retro-Tag 8 Uhr", 0, "Feedback holen"), ("Feedback holen", 0, "Zusammenführen"), ("Zusammenführen", 0, "KI: zusammenfassen"),
          ("KI: zusammenfassen", 0, "Mail an dich"))
ai(c, "Chat Model", "ai_languageModel", "KI: zusammenfassen")
vorlagen["retro-radar-zusammenfassung"] = workflow("KI-Werkstatt · Retro-Radar: Zusammenfassung", [
    notiz(w, "Anleitung", -80, -320,
          "## Retro-Radar: Zusammenfassung (Modul 5)\n1. Im **Retro-Tag 8 Uhr** Wochentag und Rhythmus eurer Retro einstellen.\n2. In **Feedback holen** die Tabelle *retro_feedback* wählen (optional nach Sprint filtern).\n3. Chat Model und Empfänger setzen, dann **Active** einschalten.", 440, 240),
    knoten(w, "Retro-Tag 8 Uhr", "n8n-nodes-base.scheduleTrigger", 1.2, 0, 0,
           {"rule": {"interval": [{"field": "weeks", "weeksInterval": 2, "triggerAtDay": [4], "triggerAtHour": 8}]}}),
    knoten(w, "Feedback holen", "n8n-nodes-base.dataTable", 1, 240, 0,
           {"operation": "get", "dataTableId": {"__rl": True, "mode": "list", "value": ""}, "returnAll": True}),
    knoten(w, "Zusammenführen", "n8n-nodes-base.aggregate", 1, 480, 0,
           {"aggregate": "aggregateAllItemData", "destinationFieldName": "feedback", "options": {}}),
    knoten(w, "KI: zusammenfassen", "@n8n/n8n-nodes-langchain.chainLlm", 1.5, 720, 0, {
        "promptType": "define", "hasOutputParser": False,
        "text": "=Rolle: Du bist ein erfahrener Agile Coach und bereitest eine Retrospektive vor.\n"
                "Ziel: Hilf dem Scrum Master, das wichtigste Thema des Teams zu treffen.\n"
                "Format:\n1. Top-3-Themen mit je einer typischen Kernaussage\n2. Stimmungstrend in einem Satz\n"
                "3. Zwei passende Retro-Formate mit Ablauf für 60 Minuten\n"
                "Grenzen: Keine Rückschlüsse auf einzelne Personen. Wenn das Feedback zu dünn ist, sag es.\n\n"
                "Eingeordnetes Feedback (JSON):\n{{ JSON.stringify($json.feedback.map(f => ({ thema: f.thema, stimmung: f.stimmung, kernaussage: f.kernaussage })), null, 1) }}"}),
    knoten(w, "Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.3, 700, 220,
           {"model": MODELL, "options": {"temperature": 0.4}}),
    knoten(w, "Mail an dich", "n8n-nodes-base.emailSend", 2.1, 980, 0,
           mail("Retro-Radar: Vorbereitung für heute", "={{ $json.text }}")),
], c)

# --- 4 Glossar-Bot (Modul 6)
w = "glossar-bot"
c = haupt(("Chat", 0, "Glossar-Agent"))
ai(c, "Chat Model", "ai_languageModel", "Glossar-Agent")
ai(c, "Gedächtnis", "ai_memory", "Glossar-Agent")
GLOSSAR = ("Du bist der Glossar-Bot eines agilen Teams. Beantworte Fragen zu Begriffen kurz und freundlich auf Deutsch, per du.\n"
           "Nutze vor allem das Team-Glossar unten. Wenn ein Begriff dort fehlt, erkläre ihn allgemein und sag dazu, dass er nicht im Team-Glossar steht.\n"
           "Erfinde keine teamspezifischen Regeln.\n\nTeam-Glossar:\n"
           "- DoD: Definition of Done. Bei uns: Code-Review, Tests grün, Doku aktualisiert, vom PO abgenommen.\n"
           "- Refinement: jeden Dienstag 60 Minuten, Stories für die nächsten zwei Sprints.\n"
           "- Impediment: alles, was das Team bremst. Meldung über das Impediment-Formular.")
vorlagen["glossar-bot"] = workflow("KI-Werkstatt · Glossar-Bot", [
    notiz(w, "Anleitung", -80, -320,
          "## Glossar-Bot (Modul 6)\n1. Chat Model wählen.\n2. Im **Glossar-Agent** unter *Options → System Message* euer echtes Team-Glossar einfügen.\n3. Unten links **Open chat** zum Testen. Mit **Active** und *Make Chat Publicly Available* im Chat-Knoten bekommt das Team eine Chat-Seite.\n4. Nächster Schritt: ein lesendes Tool anhängen (z. B. eure Glossar-Tabelle).", 460, 260),
    knoten(w, "Chat", "@n8n/n8n-nodes-langchain.chatTrigger", 1.1, 0, 0, {"options": {}}, webhookId=uid(w, "webhook")),
    knoten(w, "Glossar-Agent", "@n8n/n8n-nodes-langchain.agent", 1.7, 260, 0, {"options": {"systemMessage": GLOSSAR}}),
    knoten(w, "Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.3, 200, 220, {"model": MODELL, "options": {"temperature": 0.3}}),
    knoten(w, "Gedächtnis", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, 380, 220, {}),
], c)

os.makedirs(ZIEL, exist_ok=True)
for name, wf in vorlagen.items():
    with open(os.path.join(ZIEL, name + '.n8n.json'), 'w') as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('geschrieben:', name + '.n8n.json')
