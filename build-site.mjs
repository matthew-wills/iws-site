/**
 * Assemble the site pages from the templates: copies the case-study
 * screenshots into ./shots/ and rewrites %%SHOT_NN%% to a relative path,
 * inlines the shared theme, wraps the rendered user guide, and builds a
 * page per example report from the rendered JSON under ./reports/.
 *
 *   node build-site.mjs <shotsDir>
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shotsDir = process.argv[2];
if (!shotsDir) {
  console.error("usage: node build-site.mjs <shotsDir>");
  process.exit(1);
}
const theme = readFileSync(join(here, "theme.css"), "utf8");
const reports = {};
for (const f of readdirSync(join(here, "reports")).filter((f) => f.endsWith(".json"))) {
  reports[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(here, "reports", f), "utf8"));
}
const meta = (r) =>
  r
    ? `${r.words.toLocaleString("en-AU")} words · ${r.runLog?.engine ?? "endpoint"} · ${r.runLog?.calls?.length ?? "?"} model calls · drafted ${new Date(r.runLog?.drafted_at ?? Date.now()).toLocaleDateString("en-AU")}`
    : "";

mkdirSync(join(here, "shots"), { recursive: true });
// The published documents (PDF, cover PNGs, the collated export) copied
// from the case study's exports folder beside the shots folder.
const exportsDir = join(shotsDir, "..", "exports");
mkdirSync(join(here, "exports"), { recursive: true });
if (existsSync(exportsDir)) {
  for (const f of readdirSync(exportsDir).filter((f) => /.(pdf|png|md)$/.test(f))) copyFileSync(join(exportsDir, f), join(here, "exports", f));
}
let index = readFileSync(join(here, "index.template.html"), "utf8").replace("%%THEME%%", theme);
for (const f of readdirSync(shotsDir).filter((f) => f.endsWith(".png"))) {
  copyFileSync(join(shotsDir, f), join(here, "shots", f));
  index = index.split(`%%SHOT_${f.slice(0, 2)}%%`).join(`shots/${f}`);
}
index = index.replace("%%STANDARD_META%%", meta(reports.standard)).replace("%%PRELIMINARY_META%%", meta(reports.preliminary));
const unfilled = index.match(/%%[A-Z_0-9]+%%/g);
writeFileSync(join(here, "index.html"), index);

const fragment = readFileSync(join(here, "guide-fragment.html"), "utf8");
const guide = readFileSync(join(here, "guide.template.html"), "utf8").replace("%%THEME%%", theme).replace("%%GUIDE%%", fragment);
writeFileSync(join(here, "guide.html"), guide);

const reportTemplate = readFileSync(join(here, "report.template.html"), "utf8");
const markdownCss = existsSync(join(here, "reports", "markdown.css")) ? readFileSync(join(here, "reports", "markdown.css"), "utf8") : "";
const headings = {
  standard: ["Standard Report", "Standard investigation report", "The full report style: executive summary, event overview, analysis, findings summary and appendices, drafted section by section from the record."],
  preliminary: ["Preliminary Update", "Preliminary investigation update", "The interim style: what happened, what has been established so far, the risk exposure and the open lines of enquiry. No findings."],
};
for (const [style, r] of Object.entries(reports)) {
  const [title, heading, blurb] = headings[style] ?? [style, style, ""];
  const html = reportTemplate
    .replace("%%THEME%%", theme)
    .replace("%%MARKDOWN_CSS%%", markdownCss)
    .replace("%%TITLE%%", title)
    .replace("%%HEADING%%", heading)
    .replace("%%BLURB%%", blurb)
    .replace("%%META%%", meta(r).split(" · ").map((m) => `<span>${m}</span>`).join(""))
    .replace("%%REPORT%%", r.report)
    .replace("%%AUDIT%%", r.audit || "<p class=\"hint\">No audit was recorded for this run.</p>")
    .replace("%%CHECK%%", r.recordCheck || "<p class=\"hint\">No record check was recorded for this run.</p>")
    .replace("%%NOTES%%", r.reviewNotes || "<p class=\"hint\">No review notes.</p>");
  writeFileSync(join(here, "reports", `${style}.html`), html);
}

console.log(`index.html ${index.length} chars, guide.html ${guide.length} chars, reports: ${Object.keys(reports).join(", ")}, unfilled: ${unfilled ? unfilled.join(",") : "none"}`);
