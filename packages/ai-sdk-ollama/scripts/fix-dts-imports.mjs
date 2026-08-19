import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = new URL('../dist', import.meta.url);

function hasKnownExtension(specifier) {
  return /\.(?:[cm]?js|json|node|d\.ts)$/u.test(specifier);
}

function patchSpecifiers(content) {
  return content.replaceAll(
    /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/gu,
    (full, prefix, specifier, suffix) => {
      if (hasKnownExtension(specifier)) {
        return full;
      }
      return `${prefix}${specifier}.js${suffix}`;
    },
  );
}

async function* walk(directory) {
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    const entryStat = await stat(fullPath);
    if (entryStat.isDirectory()) {
      yield* walk(fullPath);
    } else if (fullPath.endsWith('.d.ts')) {
      yield fullPath;
    }
  }
}

async function main() {
  const distPath = DIST_DIR.pathname;
  for await (const filePath of walk(distPath)) {
    const original = await readFile(filePath, 'utf8');
    const patched = patchSpecifiers(original);
    if (patched !== original) {
      await writeFile(filePath, patched, 'utf8');
    }
  }
}

await main();
