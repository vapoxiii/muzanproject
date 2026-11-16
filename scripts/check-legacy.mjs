// Vérifie le code d'origine une fois mis bout à bout (comme dans l'app construite) :
// en module, le code est en mode strict ; une variable jamais déclarée y devient une erreur.
// On cherche donc les noms non déclarés et les erreurs de syntaxe, sans juger le style.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Linter } from 'eslint';
import globals from 'globals';

const dir = new URL('../src/legacy/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
const header = "import { sget, sset, sdel, skeys } from '/src/core/storage.js';\nimport { MS } from '/src/core/bridge.js';\nimport * as TR from '/src/training/index.js';\nimport * as TRUI from '/src/training/ui/index.js';\nimport * as TB from '/src/body/trend.js';\nimport * as HOME from '/src/home/wheel.js';\nimport * as KIT from '/src/nutrition/kitchen.js';\nimport { MASTER_IMG_URLS } from '/src/assets/master/index.js';\n";
const parts = files.map((f) => ({ f, src: readFileSync(join(dir, f), 'utf8') }));
const code = header + parts.map((p) => p.src).join('');
// table ligne → fichier
const where = [];
let line = header.split('\n').length - 1;
for (const p of parts) { const n = p.src.split('\n').length - 1; where.push({ f: p.f, from: line + 1, to: line + n }); line += n; }
const locate = (l) => { const w = where.find((x) => l >= x.from && l <= x.to); return w ? `${w.f}:${l - w.from + 1}` : `en-tête:${l}`; };

const linter = new Linter();
const messages = linter.verify(code, [{
  languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser, Quagga: 'readonly' } },
  rules: { 'no-undef': 'error', 'no-redeclare': 'error', 'no-dupe-keys': 'warn', 'no-const-assign': 'error', 'no-func-assign': 'off' },
}]);
for (const m of messages) console.log(`${m.severity === 2 ? 'ERREUR' : 'attention'}  ${locate(m.line)}  ${m.ruleId || 'syntaxe'}  ${m.message}`);
const errors = messages.filter((m) => m.severity === 2 || !m.ruleId);
if (errors.length) { console.error(`\n${errors.length} erreur(s).`); process.exit(1); }
console.log(`OK : ${files.length} fichiers, ${code.split('\n').length} lignes, aucun nom non déclaré.`);
