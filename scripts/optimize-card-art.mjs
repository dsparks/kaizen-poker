// Card art optimization pipeline.
//
// Reads full-resolution source art and emits web-sized WebP renditions into
// web_art/ (a fully derived folder — never edit it by hand). The app imports
// ONLY from web_art/; the full-res sources are kept for print/regeneration.
//
//   kaizen_illustrations/  ->  web_art/illustrations/   (in-game card faces)
//   rendered_kaizen_cards/ ->  web_art/rendered/        (gallery print previews)
//   card_back/             ->  web_art/card_back/       (card back image, if any)
//
// Incremental: a file is reprocessed only when its source is newer than its
// output. Orphaned outputs (source deleted/renamed) are removed automatically.
// Run with --force to regenerate everything (e.g. after changing sizes below).
//
// This runs automatically via the `predev` and `prebuild` npm hooks, so under
// normal workflows stale art can never ship. See CLAUDE.md ("Card art
// pipeline") before changing how art is loaded.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const FORCE = process.argv.includes("--force");
const SOURCE_EXT = /\.(png|jpe?g|webp)$/i;

const JOBS = [
  { src: "kaizen_illustrations", out: "web_art/illustrations", width: 480, quality: 80 },
  { src: "rendered_kaizen_cards", out: "web_art/rendered", width: 816, quality: 80 },
  { src: "card_back", out: "web_art/card_back", width: 480, quality: 82 },
];

let converted = 0, skipped = 0, removed = 0;
const problems = [];

for (const job of JOBS) {
  const srcDir = path.join(ROOT, job.src);
  const outDir = path.join(ROOT, job.out);
  fs.mkdirSync(outDir, { recursive: true });
  const sources = fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir).filter(f => SOURCE_EXT.test(f))
    : [];
  const expectedOutputs = new Set(sources.map(f => f.replace(SOURCE_EXT, ".webp")));

  // Remove orphaned outputs whose source was deleted or renamed.
  for (const f of fs.readdirSync(outDir)) {
    if (!expectedOutputs.has(f)) {
      fs.rmSync(path.join(outDir, f));
      removed++;
      problems.push(`removed orphan ${job.out}/${f} (no matching source in ${job.src}/)`);
    }
  }

  for (const f of sources) {
    const srcFile = path.join(srcDir, f);
    const outFile = path.join(outDir, f.replace(SOURCE_EXT, ".webp"));
    if (!FORCE && fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs > fs.statSync(srcFile).mtimeMs) {
      skipped++;
      continue;
    }
    try {
      await sharp(srcFile)
        .resize({ width: job.width, withoutEnlargement: true })
        .webp({ quality: job.quality })
        .toFile(outFile);
      converted++;
      console.log(`  ${job.src}/${f} -> ${path.relative(ROOT, outFile)}`);
    } catch (err) {
      problems.push(`FAILED ${job.src}/${f}: ${err.message}`);
    }
  }
}

console.log(`card art: ${converted} converted, ${skipped} up to date, ${removed} orphans removed`);
for (const p of problems) console.warn("  ! " + p);
if (problems.some(p => p.startsWith("FAILED"))) process.exit(1);
