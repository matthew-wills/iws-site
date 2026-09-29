/**
 * Check every relative href and src on the built pages against the disk,
 * and every in-page #fragment against the ids on the page it points at.
 *
 *   node check-links.mjs
 *
 * The pages checked are the ones build-site.mjs recorded in
 * build-manifest.json, so pages left behind by an older layout are not
 * reported. Exits non-zero if anything is missing.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = join(here, "build-manifest.json");
if (!existsSync(manifest)) {
  console.error("no build-manifest.json; run build-site.mjs first");
  process.exit(1);
}
const pages = JSON.parse(readFileSync(manifest, "utf8"));

const ids = new Map();
const idsOf = (page) => {
  if (!ids.has(page)) {
    const html = existsSync(join(here, page)) ? readFileSync(join(here, page), "utf8") : "";
    ids.set(page, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return ids.get(page);
};

let checked = 0;
const broken = [];
for (const page of pages) {
  const html = readFileSync(join(here, page), "utf8");
  const dir = dirname(join(here, page));
  for (const [, attr, raw] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    if (!raw || /^(https?:|mailto:|data:|#)/.test(raw)) {
      // An in-page fragment is checked against this page's own ids.
      if (raw.startsWith("#") && raw !== "#" && !idsOf(page).has(raw.slice(1))) broken.push(`${page} -> ${raw} (no such id on this page)`);
      continue;
    }
    checked += 1;
    const [path, fragment] = raw.split("#");
    const target = resolve(dir, decodeURIComponent(path.split("?")[0]));
    if (!existsSync(target)) {
      broken.push(`${page} -> ${raw} (${attr}, expected ${normalize(target)})`);
      continue;
    }
    if (fragment && target.endsWith(".html")) {
      const rel = target.slice(here.length + 1).split("\\").join("/");
      if (!idsOf(rel).has(fragment)) broken.push(`${page} -> ${raw} (no id "${fragment}" on that page)`);
    }
  }
}

console.log(`${pages.length} pages, ${checked} relative links checked`);
if (broken.length) {
  for (const b of broken) console.log(`  broken: ${b}`);
  console.log(`${broken.length} broken`);
  process.exit(1);
}
console.log("broken: none");
