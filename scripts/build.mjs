import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { obfuscateCode } from './obfuscator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const buildDir = path.join(rootDir, 'build');
const zipPath = path.join(buildDir, 'slack-translator.zip');

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirectory(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export async function copyStaticAssets() {
  // Copy manifest
  fs.copyFileSync(path.join(srcDir, 'manifest.json'), path.join(distDir, 'manifest.json'));

  // Copy options HTML & CSS
  fs.copyFileSync(path.join(srcDir, 'options', 'options.html'), path.join(distDir, 'options.html'));
  fs.copyFileSync(path.join(srcDir, 'options', 'options.css'), path.join(distDir, 'options.css'));

  // Copy content stylesheet
  fs.copyFileSync(path.join(srcDir, 'styles', 'content.css'), path.join(distDir, 'style.css'));

  // Copy icons
  copyDirectory(path.join(srcDir, 'icons'), path.join(distDir, 'icons'));
}

export async function bundleCode() {
  const startTime = performance.now();

  await Promise.all([
    // Background Service Worker (ESM)
    esbuild.build({
      entryPoints: [path.join(srcDir, 'background', 'index.js')],
      outfile: path.join(distDir, 'background.js'),
      bundle: true,
      format: 'esm',
      target: 'es2022',
      banner: {
        js: 'if (typeof window === "undefined" && typeof globalThis !== "undefined") { globalThis.window = globalThis; }'
      },
      minify: false,
      sourcemap: false
    }),

    // Content Script (IIFE for isolated execution in Slack)
    esbuild.build({
      entryPoints: [path.join(srcDir, 'content', 'index.js')],
      outfile: path.join(distDir, 'content.js'),
      bundle: true,
      format: 'iife',
      target: 'es2022',
      minify: false,
      sourcemap: false
    }),

    // Options Controller (IIFE)
    esbuild.build({
      entryPoints: [path.join(srcDir, 'options', 'index.js')],
      outfile: path.join(distDir, 'options.js'),
      bundle: true,
      format: 'iife',
      target: 'es2022',
      minify: false,
      sourcemap: false
    })
  ]);

  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`✓ JavaScript bundled with esbuild in ${elapsed}ms`);
}

function getTarCommand() {
  if (process.platform === 'win32') {
    const sysTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (fs.existsSync(sysTar)) {
      return `"${sysTar.replace(/\\/g, '/')}"`;
    }
  }
  return 'tar';
}

function packageZip() {
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const tarCmd = getTarCommand();
  const relativeZipPath = path.relative(distDir, zipPath).replace(/\\/g, '/');
  let buildSuccess = false;

  try {
    execSync(`${tarCmd} -cf "${relativeZipPath}" --format zip *`, {
      cwd: distDir,
      stdio: 'inherit',
      shell: true
    });
    buildSuccess = fs.existsSync(zipPath);
  } catch {
    // Fallback if environment tar lacks --format zip
  }

  if (!buildSuccess) {
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}/*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      execSync(`cd "${distDir}" && zip -r "${zipPath}" ./*`, { stdio: 'inherit' });
    }
  }

  const stats = fs.statSync(zipPath);
  console.log(`✓ Archive created: ${zipPath} (${(stats.size / 1024).toFixed(2)} KB)`);
}

export async function obfuscateDistFiles() {
  const startTime = performance.now();
  const targetFiles = ['background.js', 'content.js', 'options.js'];

  for (const filename of targetFiles) {
    const filePath = path.join(distDir, filename);
    if (fs.existsSync(filePath)) {
      const rawCode = fs.readFileSync(filePath, 'utf8');
      const obfuscated = obfuscateCode(rawCode);
      fs.writeFileSync(filePath, obfuscated, 'utf8');
    }
  }

  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`🔒 JavaScript obfuscated with Extreme Lock in ${elapsed}ms`);
}

async function main() {
  console.log('Building extension (src -> dist)...');
  cleanDir(distDir);
  await copyStaticAssets();
  await bundleCode();
  await obfuscateDistFiles();
  console.log('Packaging extension (dist -> build/slack-translator.zip)...');
  packageZip();
  console.log('Build completed successfully! Load unpacked from "dist/" in Chrome.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
