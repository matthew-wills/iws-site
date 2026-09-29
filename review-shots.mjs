/**
 * Render the built site pages locally at desktop width and capture the
 * page at successive scroll positions, so the design can be reviewed
 * without publishing. Writes review/NN.png beside the site.
 *
 *   node review-shots.mjs [width] [page...]
 *
 * With no arguments it walks the home page, one report and the guide at
 * 1440. Give a width, and optionally the pages to walk, to review one
 * page at another size: node review-shots.mjs 1920 index.html
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "file:///C:/workspaces/programming/github/investigation-workflow-suite/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

const here = dirname(fileURLToPath(import.meta.url));
const width = Number(process.argv[2]) || 1440;
const only = process.argv.slice(3);
const out = join(here, "review");
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  defaultViewport: { width, height: Math.round((width * 900) / 1440), deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function walk(file, prefix, step = 850, max = 14) {
  if (only.length && !only.includes(file)) return;
  await page.goto(pathToFileURL(join(here, file)).href, { waitUntil: "networkidle0" });
  await pause(600);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y < height && i < max; y += step, i++) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await pause(450);
    await page.screenshot({ path: join(out, `${prefix}-${String(i).padStart(2, "0")}.png`) });
  }
  console.log(`${file}: ${width}px wide, ${height}px tall, ${i} frames`);
}

await walk("index.html", "index");
await walk("reports/tarlton-springs-rto/standard.html", "report", 900, 3);
await walk("guide.html", "guide", 900, 2);
await browser.close();
