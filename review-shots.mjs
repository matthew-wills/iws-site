/**
 * Render the built site pages locally at desktop width and capture the
 * page at successive scroll positions, so the design can be reviewed
 * without publishing. Writes review/NN.png beside the site.
 *
 *   node review-shots.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "file:///C:/workspaces/programming/github/investigation-workflow-suite/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "review");
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function walk(file, prefix, step = 850, max = 14) {
  await page.goto(pathToFileURL(join(here, file)).href, { waitUntil: "networkidle0" });
  await pause(600);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y < height && i < max; y += step, i++) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await pause(450);
    await page.screenshot({ path: join(out, `${prefix}-${String(i).padStart(2, "0")}.png`) });
  }
  console.log(`${file}: ${height}px tall, ${i} frames`);
}

await walk("index.html", "index");
await walk("reports/standard.html", "report", 900, 3);
await walk("guide.html", "guide", 900, 2);
await browser.close();
