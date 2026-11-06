/**
 * Post-build pass: obfuscate Vite JS chunks in dist/assets.
 * Dev (`vite`) is untouched. Raises casual copy cost only — not real DRM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'dist', 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('obfuscate-dist: dist/assets missing — run vite build first');
  process.exit(1);
}

/**
 * Light-medium: string + identifier noise without control-flow bloat.
 * Prior pass with flattening/splitStrings ballooned ~3× — too heavy for mobile.
 */
const OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  target: 'browser',
  sourceMap: false,
};

let count = 0;
for (const name of fs.readdirSync(assetsDir)) {
  const full = path.join(assetsDir, name);
  if (name.endsWith('.map')) {
    fs.unlinkSync(full);
    console.log(`obfuscate-dist: removed ${name}`);
    continue;
  }
  if (!name.endsWith('.js')) continue;
  const code = fs.readFileSync(full, 'utf8');
  const out = JavaScriptObfuscator.obfuscate(code, OPTIONS).getObfuscatedCode();
  fs.writeFileSync(full, out);
  count += 1;
  console.log(
    `obfuscate-dist: ${name} ${code.length} → ${out.length} bytes (+${Math.round(
      ((out.length - code.length) / Math.max(code.length, 1)) * 100,
    )}%)`,
  );
}

if (!count) {
  console.error('obfuscate-dist: no .js chunks found in dist/assets');
  process.exit(1);
}
