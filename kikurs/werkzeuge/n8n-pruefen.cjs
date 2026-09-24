// Prüft die n8n-Vorlagen gegen die Knotenbeschreibungen einer echten
// n8n-Installation: Gibt es Typ und Version? Kennt der Knoten jeden
// gesetzten Parameter? Welche Pflichtfelder bleiben offen?
//
//   npm install n8n --prefix /tmp/n8n
//   N8N_MODULE=/tmp/n8n/node_modules node kikurs/werkzeuge/n8n-pruefen.cjs
//
// Offen bleiben dürfen nur Felder, die bewusst nach dem Import gesetzt
// werden (Tabelle auswählen); alles andere ist ein Fehler.
const fs = require('fs');
const path = require('path');
const NM = process.env.N8N_MODULE;
if (!NM) { console.error('N8N_MODULE fehlt (Pfad zu node_modules mit n8n).'); process.exit(2); }
const { NodeHelpers } = require(path.join(NM, 'n8n-workflow'));
const B = path.join(NM, 'n8n-nodes-base/dist/nodes/'), L = path.join(NM, '@n8n/n8n-nodes-langchain/dist/nodes/');
const karte = {
  'n8n-nodes-base.formTrigger': B + 'Form/FormTrigger.node.js',
  'n8n-nodes-base.if': B + 'If/If.node.js',
  'n8n-nodes-base.emailSend': B + 'EmailSend/EmailSend.node.js',
  'n8n-nodes-base.scheduleTrigger': B + 'Schedule/ScheduleTrigger.node.js',
  'n8n-nodes-base.dataTable': B + 'DataTable/DataTable.node.js',
  'n8n-nodes-base.aggregate': B + 'Transform/Aggregate/Aggregate.node.js',
  'n8n-nodes-base.stickyNote': B + 'StickyNote/StickyNote.node.js',
  '@n8n/n8n-nodes-langchain.chainLlm': L + 'chains/ChainLLM/ChainLlm.node.js',
  '@n8n/n8n-nodes-langchain.lmChatAnthropic': L + 'llms/LMChatAnthropic/LmChatAnthropic.node.js',
  '@n8n/n8n-nodes-langchain.outputParserStructured': L + 'output_parser/OutputParserStructured/OutputParserStructured.node.js',
  '@n8n/n8n-nodes-langchain.agent': L + 'agents/Agent/Agent.node.js',
  '@n8n/n8n-nodes-langchain.chatTrigger': L + 'trigger/ChatTrigger/ChatTrigger.node.js',
  '@n8n/n8n-nodes-langchain.memoryBufferWindow': L + 'memory/MemoryBufferWindow/MemoryBufferWindow.node.js',
};
const ERLAUBT_OFFEN = new Set(['dataTableId']);

function beschreibung(typ, version) {
  const datei = karte[typ];
  if (!datei) throw new Error('Typ nicht in der Prüfliste: ' + typ);
  const mod = require(datei);
  const Klasse = Object.values(mod).find((v) => typeof v === 'function');
  const inst = new Klasse();
  if (inst.nodeVersions) {
    const v = inst.nodeVersions[version];
    if (!v) throw new Error(`${typ}: Version ${version} gibt es nicht (vorhanden: ${Object.keys(inst.nodeVersions).join(', ')})`);
    return Object.assign({}, inst.description, v.description);
  }
  if (![].concat(inst.description.version).includes(version)) throw new Error(`${typ}: Version ${version} gibt es nicht`);
  return inst.description;
}

// Alle Parameternamen, die eine Beschreibung irgendwo (auch verschachtelt) kennt.
function namen(props, menge = new Set()) {
  for (const p of props || []) {
    menge.add(p.name);
    if (p.options) for (const o of p.options) { if (o.values) namen(o.values, menge); else if (o.type) namen([o], menge); }
  }
  return menge;
}
function schluessel(obj, menge = new Set()) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && !obj.__rl) {
    for (const [k, v] of Object.entries(obj)) {
      menge.add(k);
      if (Array.isArray(v)) v.forEach((x) => schluessel(x, menge)); else schluessel(v, menge);
    }
  }
  return menge;
}

const verzeichnis = path.join(__dirname, '..', 'public', 'vorlagen');
let fehler = 0;
for (const datei of fs.readdirSync(verzeichnis).filter((d) => d.endsWith('.json'))) {
  const wf = JSON.parse(fs.readFileSync(path.join(verzeichnis, datei), 'utf8'));
  for (const node of wf.nodes) {
    const ort = `${datei} › ${node.name}`;
    try {
      const d = beschreibung(node.type, node.typeVersion);
      const bekannt = namen(d.properties);
      // Werte in resourceMapper-/Spaltenlisten sind frei benannt.
      const params = JSON.parse(JSON.stringify(node.parameters));
      if (params.columns) params.columns = { mappingMode: params.columns.mappingMode };
      if (params.conditions) params.conditions = {};
      const unbekannt = [...schluessel(params)].filter((k) => !bekannt.has(k) && !['values', 'value', 'option', 'mappingMode', 'interval', 'field', 'weeksInterval', 'triggerAtDay', 'triggerAtHour'].includes(k));
      const voll = NodeHelpers.getNodeParameters(d.properties, node.parameters, true, false, node, d);
      const probleme = NodeHelpers.getNodeParametersIssues(d.properties, Object.assign({}, node, { parameters: voll }), d);
      const offen = Object.keys((probleme && probleme.parameters) || {}).filter((k) => !ERLAUBT_OFFEN.has(k));
      if (unbekannt.length || offen.length) {
        fehler++;
        console.log('FEHL ' + ort + (unbekannt.length ? ' — unbekannte Parameter: ' + unbekannt.join(', ') : '') +
          (offen.length ? ' — offene Pflichtfelder: ' + offen.map((k) => k + ' (' + probleme.parameters[k].join('; ') + ')').join(', ') : ''));
      } else {
        console.log('OK   ' + ort + ` (${node.type} v${node.typeVersion})`);
      }
    } catch (e) {
      fehler++;
      console.log('FEHL ' + ort + ' — ' + e.message);
    }
  }
}
console.log(fehler ? `\n${fehler} Problem(e)` : '\nAlle Vorlagen passen zu dieser n8n-Version.');
process.exit(fehler ? 1 : 0);
