import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { copyStaticAssets, obfuscateDistFiles } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

await copyStaticAssets();
console.log('✓ Initial assets copied to dist/');

let isObfuscating = false;
let needsReObfuscate = false;

async function triggerObfuscate(source) {
  if (isObfuscating) {
    needsReObfuscate = true;
    return;
  }

  isObfuscating = true;
  try {
    await obfuscateDistFiles();
    console.log(`[Dev] Obfuscated dist/ files (${source})`);
  } catch (err) {
    console.error('[Dev] Obfuscation error:', err.message);
  } finally {
    isObfuscating = false;
    if (needsReObfuscate) {
      needsReObfuscate = false;
      await triggerObfuscate('queued-changes');
    }
  }
}

const createDevPlugin = (entryName) => ({
  name: `dev-${entryName}-plugin`,
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length === 0) {
        await triggerObfuscate(entryName);
      }
    });
  }
});

const contexts = await Promise.all([
  esbuild.context({
    entryPoints: [path.join(srcDir, 'background', 'index.js')],
    outfile: path.join(distDir, 'background.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    banner: {
      js: 'if (typeof window === "undefined" && typeof globalThis !== "undefined") { globalThis.window = globalThis; }'
    },
    plugins: [createDevPlugin('background')]
  }),
  esbuild.context({
    entryPoints: [path.join(srcDir, 'content', 'index.js')],
    outfile: path.join(distDir, 'content.js'),
    bundle: true,
    format: 'iife',
    target: 'es2022',
    plugins: [createDevPlugin('content')]
  }),
  esbuild.context({
    entryPoints: [path.join(srcDir, 'options', 'index.js')],
    outfile: path.join(distDir, 'options.js'),
    bundle: true,
    format: 'iife',
    target: 'es2022',
    plugins: [createDevPlugin('options')]
  })
]);

await Promise.all(contexts.map((ctx) => ctx.watch()));

// Watch static assets
fs.watch(srcDir, { recursive: true }, async (eventType, filename) => {
  if (!filename) return;
  if (
    filename.endsWith('.html') ||
    filename.endsWith('.css') ||
    filename.endsWith('.json') ||
    filename.startsWith('icons')
  ) {
    try {
      await copyStaticAssets();
      console.log(`[Watch] Static asset updated: ${filename}`);
    } catch {
      // Ignore transient file lock errors
    }
  }
});

console.log('⚡ Watching src/ with auto-obfuscation active... Press Ctrl+C to stop.');
console.log('👉 In Chrome (chrome://extensions), load unpacked from:');
console.log(`   ${distDir}`);
