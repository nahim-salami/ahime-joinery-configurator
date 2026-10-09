/**
 * Packs the plugin folder as the ZIP file uploaded to WordPress.org:
 * dist/ahime-joinery-configurator-<version>.zip, with a single top-level folder `ahime-joinery-configurator/`.
 *
 * Run `npm run build` first: the ZIP refuses to be made without the built assets.
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const racine = fileURLToPath(new URL('..', import.meta.url));
const slug = 'ahime-joinery-configurator';
const dossier = join(racine, slug);
const { version: versionDuPaquet } = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));

if (!existsSync(join(dossier, 'assets', 'ahjc-widget.js'))) {
  console.error('ahjc-widget.js is missing: run `npm run build` first.');
  process.exit(1);
}

const fichiers = {};
const parcourir = (chemin) => {
  for (const nom of readdirSync(chemin).sort()) {
    const complet = join(chemin, nom);
    if (statSync(complet).isDirectory()) parcourir(complet);
    else fichiers[`${slug}/${relative(dossier, complet).split('\\').join('/')}`] = [
      readFileSync(complet),
      { mtime: new Date('2026-01-01T00:00:00Z') },
    ];
  }
};
parcourir(dossier);

mkdirSync(join(racine, 'dist'), { recursive: true });
const sortie = join(racine, 'dist', `${slug}-${versionDuPaquet}.zip`);
writeFileSync(sortie, zipSync(fichiers, { level: 9 }));
console.log(`${sortie} (${Object.keys(fichiers).length} files)`);
