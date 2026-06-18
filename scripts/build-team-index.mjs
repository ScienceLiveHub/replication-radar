// Regenerates site/bios/index.json — the offline fallback list of bio files.
// The live team page discovers bios via the GitHub API; this index is only used
// when that call is unavailable (rate-limited / offline / local preview).
// Run: node scripts/build-team-index.mjs
import { readdirSync, writeFileSync } from "node:fs";

const dir = "site/bios";
const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
writeFileSync(`${dir}/index.json`, JSON.stringify(files, null, 2) + "\n");
console.log(`wrote ${dir}/index.json (${files.length} bios)`);
