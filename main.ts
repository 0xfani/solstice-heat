// Solstice Heat — entry program for make.fun gta6-01 (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with the vendored make.fun library. It validates the
// screenshot set against the scorer's caps first, so a bad build fails here, not at the gate.
// Deterministic by construction — two runs write identical bytes, no network, no clock reads.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const SHOT_CAP_BYTES = 262144;

function handInGame() {
  const gameSrc = join(repoRoot, 'game');
  if (!existsSync(join(gameSrc, 'index.html'))) {
    throw new Error('game/index.html is missing — build the game before handing it in');
  }
  mkdirSync(outputDir, { recursive: true });
  cpSync(gameSrc, join(outputDir, 'game'), { recursive: true });
}

function handInScreenshots() {
  const shotsSrc = join(repoRoot, 'screenshots');
  const shotsDest = join(outputDir, 'screenshots');
  mkdirSync(shotsDest, { recursive: true });
  if (!existsSync(shotsSrc)) throw new Error('screenshots/ is missing');
  const names = readdirSync(shotsSrc).filter((n) => !n.startsWith('.')).sort();
  if (names.length < 3 || names.length > 4) {
    throw new Error(`screenshots/ must hold 3 or 4 images, found ${names.length}`);
  }
  for (const name of names) {
    const size = statSync(join(shotsSrc, name)).size;
    if (size > SHOT_CAP_BYTES) throw new Error(`${name} is ${size} bytes, over the 256 KiB cap`);
  }
  cpSync(shotsSrc, shotsDest, { recursive: true });
}

handInGame();
handInScreenshots();
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: SHOT_CAP_BYTES },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('Solstice Heat handed in: game/, screenshots/, dossier.json');
