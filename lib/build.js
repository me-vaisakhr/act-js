'use strict';

/**
 * lib/build.js — Native Act JS bundler
 * Zero external dependencies. Uses only Node.js built-ins.
 *
 * What it does:
 *   1. Walks the JS module graph from app.js (topological sort)
 *      - CSS files imported via `with { type: "css" }` are auto-discovered
 *   2. Strips ES module syntax → single IIFE → dist/bundle.js
 *   3. Copies all discovered CSS files to dist/ (preserving structure)
 *   4. Transforms index.html generically → dist/index.html
 *      - preload links  → regular <link rel="stylesheet">
 *      - <noscript>     → removed
 *      - <script module> → <script src="bundle.js">
 *      - injects <link> for each CSS file found in JS imports
 *
 * Run from project root:
 *   node lib/build.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ─── JS BUNDLER ────────────────────────────────────────────────────────────

const visited            = new Set();
const orderedModules     = []; // topological order, filled by walk()
const discoveredCSSFiles = []; // auto-collected from CSS module script imports

/**
 * Parse one file's imports.
 * - JS imports  → resolved absolute paths (for recursive walk)
 * - CSS imports → pushed into discoveredCSSFiles (for copy + HTML injection)
 */
function parseImports(code, fromFile) {
  const dir       = path.dirname(fromFile);
  const jsImports = [];

  // Matches:  import <stuff> from "<specifier>"  (with optional with { type: "css" })
  const re = /^import\s+[\s\S]*?\bfrom\s+['"]([^'"]+)['"]\s*(?:with\s*\{[^}]*\})?\s*;?/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const specifier = m[1];
    if (!specifier.startsWith('.')) continue; // skip bare specifiers

    if (specifier.endsWith('.css')) {
      // Auto-discover CSS files — no hardcoded list needed
      const absPath = path.resolve(dir, specifier);
      if (!discoveredCSSFiles.includes(absPath)) {
        discoveredCSSFiles.push(absPath);
      }
      continue;
    }

    let resolved = path.resolve(dir, specifier);
    if (!fs.existsSync(resolved)) {
      if (fs.existsSync(resolved + '.js')) resolved = resolved + '.js';
      else continue;
    }
    jsImports.push(resolved);
  }

  return jsImports;
}

/**
 * Transform one JS file for inclusion in the bundle:
 *
 *   CSS module import   →  const name = null;   (CSS is in <link> tags instead)
 *   import { x } from  →  (removed — all files share the IIFE scope)
 *   export function F  →  function F
 *   export { x }       →  (removed)
 *   export default     →  const _default =
 */
function transformCode(code) {
  // 1. CSS module script imports → const name = null
  code = code.replace(
    /^import\s+(\w+)\s+from\s+['"][^'"]*\.css['"]\s*with\s*\{[^}]*\}\s*;?[ \t]*\r?\n?/gm,
    (_, name) => `const ${name} = null;\n`
  );

  // 2. Remove all remaining import statements
  code = code.replace(
    /^import\s+(?:[\w*{}\s,]+\s+from\s+)?['"][^'"]+['"]\s*(?:with\s*\{[^}]*\})?\s*;?[ \t]*\r?\n?/gm,
    ''
  );

  // 3. Strip 'export' from declarations
  code = code.replace(
    /^export\s+((?:async\s+)?function\*?|class|const|let|var)\s+/gm,
    '$1 '
  );

  // 4. Remove export { ... } statements
  code = code.replace(/^export\s*\{[^}]*\}\s*;?[ \t]*\r?\n?/gm, '');

  // 5. export default → const _default =
  code = code.replace(/^export\s+default\s+/gm, 'const _default = ');

  return code;
}

/**
 * Depth-first walk of the module graph (dependency-first / post-order).
 * Side effects: populates orderedModules and discoveredCSSFiles.
 */
function walk(filePath) {
  if (visited.has(filePath)) return;
  visited.add(filePath);

  const code = fs.readFileSync(filePath, 'utf8');
  const deps = parseImports(code, filePath);

  for (const dep of deps) walk(dep);

  orderedModules.push({ filePath, code });
}

/** Bundle all modules into a single IIFE string. */
function bundle() {
  walk(path.join(ROOT, 'app.js'));

  const parts = orderedModules.map(({ filePath, code }) => {
    const rel         = path.relative(ROOT, filePath);
    const transformed = transformCode(code);
    return `// ── ${rel} ──\n${transformed.trimEnd()}`;
  });

  return `(function () {\n'use strict';\n\n${parts.join('\n\n')}\n\n})();\n`;
}

// ─── HTML TRANSFORMER ──────────────────────────────────────────────────────

/**
 * Transform the source index.html into the built version.
 * All changes are derived from what's in the file — nothing is hardcoded.
 *
 *  <link rel="preload" as="style" onload="...">   →  <link rel="stylesheet" href="...">
 *  <noscript>...</noscript>                        →  (removed)
 *  Discovered CSS module imports                   →  inlined as <style> block (true critical CSS)
 *  <script type="module" src="app.js">             →  <script src="bundle.js">
 */
function transformHTML(html) {
  // 1. Preload stylesheet links → regular links (non-critical CSS stays as <link>)
  html = html.replace(
    /<link\s[^>]*rel=["']preload["'][^>]*as=["']style["'][^>]*>/g,
    (match) => {
      const hrefMatch = match.match(/href=["']([^"']+)["']/);
      return hrefMatch ? `<link rel="stylesheet" href="${hrefMatch[1]}">` : '';
    }
  );

  // 2. Remove <noscript> blocks (no longer needed — script is not a module)
  //    Also eat the leading whitespace on the same line to avoid blank lines
  html = html.replace(/[ \t]*<noscript>[\s\S]*?<\/noscript>[ \t]*\r?\n?/g, '');

  // 3. Inline critical CSS from JS imports as a single <style> block
  //    These are the component stylesheets registered via app.criticalStylesheet()
  if (discoveredCSSFiles.length > 0) {
    const parts = discoveredCSSFiles.map(abs => {
      const rel = path.relative(ROOT, abs);
      const content = fs.readFileSync(abs, 'utf8').trim();
      return `/* ${rel} */\n${content}`;
    });
    const styleBlock =
      '    <!-- Critical CSS — inlined at build time -->\n' +
      '    <style>\n' +
      parts.join('\n\n') + '\n' +
      '    </style>';
    html = html.replace(/\n(\s*)<\/head>/, `\n${styleBlock}\n$1</head>`);
  }

  // 4. Replace ES module script with plain bundle script
  html = html.replace(
    /<script\s+type=["']module["']\s+src=["'][^"']*["']\s*><\/script>/,
    '<script src="bundle.js"></script>'
  );

  return html;
}

// ─── FILE UTILITIES ────────────────────────────────────────────────────────

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

// ─── BUILD ─────────────────────────────────────────────────────────────────

function build() {
  // Clean dist/
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  mkdirp(DIST);

  // 1. Bundle JS  (also populates discoveredCSSFiles as a side effect)
  process.stdout.write('Bundling JS...  ');
  const bundleJS = bundle();
  fs.writeFileSync(path.join(DIST, 'bundle.js'), bundleJS);
  console.log(`✓  (${orderedModules.length} modules, ${(bundleJS.length / 1024).toFixed(1)} KB)`);

  // 2. Copy CSS files discovered from JS imports (preserving directory structure)
  process.stdout.write('Copying CSS...  ');
  for (const absPath of discoveredCSSFiles) {
    copyFile(absPath, path.join(DIST, path.relative(ROOT, absPath)));
  }

  // 3. Copy CSS files linked directly in index.html (e.g. styles.css)
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const linkRe   = /href=["']([^"']*\.css)["']/g;
  let lm;
  const htmlCSS = new Set();
  while ((lm = linkRe.exec(indexSrc)) !== null) htmlCSS.add(lm[1]);
  for (const relPath of htmlCSS) {
    const src = path.join(ROOT, relPath);
    if (fs.existsSync(src)) copyFile(src, path.join(DIST, relPath));
  }
  console.log(`✓  (${discoveredCSSFiles.length + htmlCSS.size} files)`);

  // 4. Transform index.html and write to dist/
  process.stdout.write('Writing HTML... ');
  fs.writeFileSync(path.join(DIST, 'index.html'), transformHTML(indexSrc));
  console.log('✓');

  console.log('\n✓  Built dist/  —  open dist/index.html directly in any browser\n');
}

build();
