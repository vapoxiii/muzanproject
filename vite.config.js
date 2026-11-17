import { defineConfig } from 'vite';
import { readFileSync, readdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import MagicString, { Bundle } from 'magic-string';

const root = resolve(import.meta.dirname);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const LEGACY_DIR = join(root, 'src/legacy');
const LEGACY_ID = 'virtual:legacy-app';
const LEGACY_FILE = join(LEGACY_DIR, '_app.js');     // identifiant « fichier » : garde les cartes de code source

// Le code d'origine est découpé en fichiers (src/legacy/NN-*.js) qui partagent une seule
// portée, comme avant. Ce greffon les met bout à bout, dans l'ordre des numéros, en un
// seul module, précédé des imports dont ils ont besoin (stockage, pont vers le cœur).
function legacyApp() {
  const files = () => readdirSync(LEGACY_DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  return {
    name: 'mon-suivi-legacy',
    // (en développement, le navigateur redemande le module par son chemin /src/legacy/_app.js)
    resolveId(id) { return id === LEGACY_ID || id === LEGACY_FILE || id.split('?')[0] === '/src/legacy/_app.js' ? LEGACY_FILE : null; },
    load(id) {
      if (id !== LEGACY_FILE) return null;
      const bundle = new Bundle();
      bundle.addSource({
        filename: '_imports.js',
        content: new MagicString(
          "import { sget, sset, sdel, skeys } from '/src/core/storage.js';\n" +
          "import { MS } from '/src/core/bridge.js';\n" +
          "import * as TR from '/src/training/index.js';\n" +
          "import * as TRUI from '/src/training/ui/index.js';\n" +
          "import * as TB from '/src/body/trend.js';\n" +
          "import * as HOME from '/src/home/wheel.js';\n" +
          "import * as KIT from '/src/nutrition/kitchen.js';\n" +
          "import * as BRAND from '/src/ui/brand.js';\n" +
          "import { MASTER_IMG_URLS } from '/src/assets/master/index.js';\n"
        ),
      });
      for (const f of files()) {
        const path = join(LEGACY_DIR, f);
        this.addWatchFile(path);
        bundle.addSource({ filename: f, content: new MagicString(readFileSync(path, 'utf8')) });
      }
      const code = bundle.toString();
      return { code, map: bundle.generateMap({ hires: true, includeContent: true }) };
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(LEGACY_DIR)) {
        const mod = server.moduleGraph.getModuleById(LEGACY_FILE);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

// Service worker : liste de tous les fichiers construits, version = empreinte du contenu.
function serviceWorker() {
  let outDir = 'dist';
  return {
    name: 'mon-suivi-sw',
    apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    closeBundle() {
      const list = [];
      const walk = (d) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          if (statSync(p).isDirectory()) walk(p);
          else list.push(relative(outDir, p).split(sep).join('/'));
        }
      };
      walk(outDir);
      const files = list
        // illustrations des exercices (exos/) : gardées au premier affichage, pas à l'installation
        .filter((f) => f !== 'sw.js' && f !== 'mon-suivi-app.html' && !f.endsWith('.map') && !f.endsWith('.woff') && !f.startsWith('.') && !f.startsWith('exos/'))
        .sort();
      const h = createHash('sha256');
      for (const f of files) h.update(f).update(readFileSync(join(outDir, f)));
      const version = pkg.version + '-' + h.digest('hex').slice(0, 10);
      // la page connaît sa version (balise ms-version) : au démarrage, si le service worker actif
      // est plus récent que la page servie, l'app se recharge sur la nouvelle version
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      if (!html.includes('__MS_VERSION__')) throw new Error('index.html : balise ms-version absente');
      writeFileSync(join(outDir, 'index.html'), html.replace('__MS_VERSION__', version));
      // page d'entrée sous l'ancien nom aussi : l'icône déjà posée sur l'écran d'accueil
      // (…/mon-suivi-app.html) ouvre la nouvelle version, avec les mêmes données.
      copyFileSync(join(outDir, 'index.html'), join(outDir, 'mon-suivi-app.html'));
      const urls = files.map((f) => './' + f);
      const sw = readFileSync(join(root, 'src/sw-template.js'), 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__FILES__', JSON.stringify(urls, null, 0));
      writeFileSync(join(outDir, 'sw.js'), sw);
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ version, files: files.length }) + '\n');
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version + (mode === 'production' ? '' : '-' + mode)),
  },
  build: {
    target: ['es2022', 'safari15.4', 'chrome100', 'firefox100'],
    sourcemap: mode !== 'apercu',
    // aperçu publié dans Claude : les polices dans la feuille de style (le cadre n'accepte pas de fichier de police à part)
    assetsInlineLimit: mode === 'apercu' ? (file) => /\.woff2?$/.test(file) : 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // noms lisibles (et sans « _ » initial, que GitHub Pages ignore s'il passe par Jekyll)
        chunkFileNames: (c) => (c.name === '_app' || c.name.includes('legacy-app') ? 'assets/app-[hash].js'
          : (c.moduleIds || []).some((id) => id.includes('@supabase')) ? 'assets/supabase-[hash].js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  plugins: [legacyApp(), serviceWorker()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  test: {
    include: ['tests/unit/**/*.test.{js,ts}'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.js'],
  },
}));
