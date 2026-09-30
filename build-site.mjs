/**
 * Assemble the site pages from the templates.
 *
 *   node build-site.mjs <appCaseStudiesDir>
 *
 * <appCaseStudiesDir> is the application repository's `case-studies`
 * folder. Every folder under ./case-studies/ here that holds a meta.json
 * and has a folder of the same name over there is built:
 *
 *   shots/<slug>/            the study's screenshots, copied in
 *   exports/<slug>/          its published documents (pdf, png, md)
 *   exports/<slug>/pages/    the page-by-page renders of each document
 *   exports/<slug>/<doc>.html    a viewer per document
 *   reports/<slug>/<style>.json  the rendered reports (generated, see below)
 *   reports/<slug>/<style>.html  a page per report
 *   case-studies/<slug>.html     the study's own page
 *
 * A study whose application folder is missing, or whose reports have not
 * been rendered and cannot be rendered here, is skipped with a printed
 * note rather than failing the build.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appCaseStudies = process.argv[2];
if (!appCaseStudies) {
  console.error("usage: node build-site.mjs <appCaseStudiesDir>");
  process.exit(1);
}
const appRoot = join(appCaseStudies, "..");
const theme = readFileSync(join(here, "theme.css"), "utf8");
const built = [];
const write = (rel, html) => {
  const path = join(here, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
  built.push(rel.split("\\").join("/"));
};

/** Every page except index.html is a complete document: index.html is
 *  wrapped by the host it is published through, but the other pages are
 *  served as they are and render in quirks mode without a doctype,
 *  charset and viewport of their own. */
const document = (title, body) => {
  const withoutTitle = body.replace(/<title>[^<]*<\/title>\n?/, "");
  const head = `<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n`;
  // The template opens with its <style>; the head closes after it and the
  // body opens, so the markup that follows lands where it should.
  return `${head}${withoutTitle.replace("</style>", "</style>\n</head>\n<body>")}\n</body>\n</html>\n`;
};
const unfilled = (html) => html.match(/%%[A-Z_0-9]+%%/g) ?? [];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const meta = (r) =>
  r
    ? `${r.words.toLocaleString("en-AU")} words · ${r.runLog?.engine ?? "endpoint"} · ${r.runLog?.calls?.length ?? "?"} model calls · drafted ${new Date(r.runLog?.drafted_at ?? Date.now()).toLocaleDateString("en-AU")}`
    : "";
const copyInto = (from, to, keep) => {
  mkdirSync(to, { recursive: true });
  const files = readdirSync(from).filter((f) => statSync(join(from, f)).isFile() && keep.test(f));
  for (const f of files) copyFileSync(join(from, f), join(to, f));
  return files;
};

/** The headings for a published document's viewer. The application names
 *  these files the same way for every case study, so the copy is shared;
 *  an unknown name falls back to the name itself. */
const docCopy = {
  report_standard: ["Standard Report", "Standard investigation report, as published", "The full report written to the application’s Word template and converted to PDF: cover, distribution list and the report as drafted, section by section from the record."],
  report_preliminary: ["Preliminary Update", "Preliminary investigation update, as published", "The interim style on the same template: what has been established so far and what is still open, with no findings."],
  report_executive: ["Executive Brief", "Executive brief, as published", "The short style on the same template: the occurrence, what was found and what is being done, in a few pages of plain language for the people who decide."],
  report_atsb: ["ATSB-style Final Report", "ATSB-style final report, as published", "Modelled on the structure and conventions of published ATSB final reports, on the same template: summary, occurrence, context, safety analysis, findings, safety issues and actions."],
  report_ntsb: ["Probable Cause Report", "Probable cause report, as published", "The NTSB-shaped style on the same template: factual information, analysis, conclusions carrying the findings, the probable cause and the contributing factors, then recommendations."],
  report_aaib: ["Causal and Contributory Factors Report", "Causal and contributory factors report, as published", "The AAIB-shaped style on the same template: synopsis, factual information, analysis, conclusions carrying the findings and splitting causal from contributory factors, then safety action and recommendations."],
  eii_tables: ["E/I/I Tables", "E/I/I test tables, as published", "One table per object: each test’s result and confidence, the evidence recorded for and against it, and the investigator’s reasoning."],
  source_pack: ["Source Pack", "Investigation source pack", "Every source document this investigation worked from, in one file and in reading order: the safety report, the records and extracts, and the interview transcripts."],
};
/** The headings for a report style's page, keyed by the folder name the
 *  application's reports sit in. */
const reportCopy = {
  standard: ["Standard Report", "Standard investigation report", "The full report style: executive summary, event overview, analysis, findings summary and appendices, drafted section by section from the record."],
  preliminary: ["Preliminary Update", "Preliminary investigation update", "The interim style: what happened, what has been established so far, the risk exposure and the open lines of enquiry. No findings."],
  executive: ["Executive Brief", "Executive brief", "The occurrence, the findings and the actions on a few pages for the people who decide."],
  atsb: ["ATSB-style Final Report", "ATSB-style final report", "Modelled on the structure and conventions of published ATSB final reports: summary, occurrence, context, safety analysis, findings, safety issues and actions."],
  ntsb: ["Probable Cause Report", "Probable cause report", "The NTSB-shaped style: factual information, analysis, conclusions carrying the findings, the probable cause and the contributing factors, then recommendations."],
  aaib: ["Causal and Contributory Factors Report", "Causal and contributory factors report", "The AAIB-shaped style: synopsis, factual information, analysis, conclusions carrying the findings and splitting causal from contributory factors, then safety action and recommendations."],
};

// ---------------------------------------------------------------- studies

const studyDirs = existsSync(join(here, "case-studies"))
  ? readdirSync(join(here, "case-studies")).filter((f) => statSync(join(here, "case-studies", f)).isDirectory())
  : [];
const studies = [];
for (const slug of studyDirs) {
  const dir = join(here, "case-studies", slug);
  if (!existsSync(join(dir, "meta.json"))) {
    console.log(`skipped ${slug}: no case-studies/${slug}/meta.json`);
    continue;
  }
  if (!existsSync(join(dir, "content.html"))) {
    console.log(`skipped ${slug}: no case-studies/${slug}/content.html`);
    continue;
  }
  const appDir = join(appCaseStudies, slug);
  if (!existsSync(appDir)) {
    console.log(`skipped ${slug}: nothing at ${appDir}`);
    continue;
  }
  const m = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  studies.push({ ...m, slug: m.slug ?? slug, dir, appDir });
}
studies.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.slug.localeCompare(b.slug));

const summaries = [];
for (const study of studies) {
  const { slug, appDir } = study;
  const notes = [];

  // Screenshots: copied in once, and every %%SHOT_NN%% on this study's
  // page rewritten to the path here. The number is the file's prefix.
  const shotFiles = existsSync(join(appDir, "shots")) ? copyInto(join(appDir, "shots"), join(here, "shots", slug), /\.png$/) : [];
  if (!shotFiles.length) notes.push("no screenshots");
  const shotPath = (prefix) => (f) => `${prefix}shots/${slug}/${f}`;
  const withShots = (html, prefix) => shotFiles.reduce((h, f) => h.split(`%%SHOT_${f.slice(0, 2)}%%`).join(shotPath(prefix)(f)), html);

  // The published documents, and the page renders behind each viewer.
  const exportsDir = join(appDir, "exports");
  if (existsSync(exportsDir)) copyInto(exportsDir, join(here, "exports", slug), /\.(pdf|png|md)$/);
  else notes.push("no exports");

  // The rendered reports. The application writes them; render them from
  // here when they are not there yet, and skip the study's report pages
  // if that cannot be done.
  const reportsOut = join(here, "reports", slug);
  const hasJson = () => existsSync(reportsOut) && readdirSync(reportsOut).some((f) => f.endsWith(".json"));
  if (!hasJson()) {
    console.log(`${slug}: rendering reports (npx vite-node scripts/render-case-reports.tsx ${slug})`);
    const r = spawnSync("npx", ["vite-node", "scripts/render-case-reports.tsx", slug, relative(appRoot, reportsOut)], {
      cwd: appRoot,
      shell: true,
      stdio: "inherit",
    });
    if (r.status !== 0) notes.push(`could not render reports; run "npx vite-node scripts/render-case-reports.tsx ${slug} ../iws-site/reports/${slug}" in the application repository`);
  }
  const reports = {};
  if (hasJson()) {
    for (const f of readdirSync(reportsOut).filter((f) => f.endsWith(".json"))) {
      reports[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(reportsOut, f), "utf8"));
    }
  }
  const declaredReports = study.reports ?? Object.keys(reports);
  const missingReports = declaredReports.filter((s) => !reports[s]);
  if (missingReports.length) notes.push(`reports not rendered: ${missingReports.join(", ")}`);
  const caseUrl = `../../case-studies/${slug}.html`;

  // A page per report style: the report as drafted, with the grounding
  // audit, the mechanical record check and the review notes beside it.
  const reportTemplate = readFileSync(join(here, "report.template.html"), "utf8");
  const markdownCss = existsSync(join(reportsOut, "markdown.css")) ? readFileSync(join(reportsOut, "markdown.css"), "utf8") : "";
  const pageHoles = [];
  for (const style of declaredReports.filter((s) => reports[s])) {
    const r = reports[style];
    const [title, heading, blurb] = reportCopy[style] ?? [style, style, ""];
    const html = reportTemplate
      .replace("%%THEME%%", theme)
      .replace("%%MARKDOWN_CSS%%", markdownCss)
      .replace("%%TITLE%%", title)
      .replaceAll("%%CASE_URL%%", caseUrl)
      .replaceAll("%%CASE_TITLE%%", esc(study.title))
      .replace("%%HEADING%%", heading)
      .replace("%%BLURB%%", blurb)
      .replace("%%META%%", meta(r).split(" · ").map((m) => `<span>${m}</span>`).join(""))
      .replace("%%REPORT%%", r.report)
      .replace("%%AUDIT%%", r.audit || '<p class="hint">No audit was recorded for this run.</p>')
      .replace("%%CHECK%%", r.recordCheck || '<p class="hint">No record check was recorded for this run.</p>')
      .replace("%%NOTES%%", r.reviewNotes || '<p class="hint">No review notes.</p>');
    pageHoles.push(...unfilled(html));
    write(join("reports", slug, `${style}.html`), document(`${title}, ${study.title}`, html));
  }

  // A page-by-page viewer for each published document, from the page
  // renders under exports/pages/<name>/, so a browser that cannot show
  // the PDF (a sandboxed preview) still reads the document as published.
  const docTemplate = readFileSync(join(here, "document.template.html"), "utf8");
  const pagesRoot = join(exportsDir, "pages");
  const wantDocs = [...declaredReports.map((s) => `report_${s}`), ...(study.documents ?? [])];
  const haveDocs = existsSync(pagesRoot) ? readdirSync(pagesRoot).filter((f) => statSync(join(pagesRoot, f)).isDirectory()) : [];
  const docs = wantDocs.filter((d) => haveDocs.includes(d));
  const missingDocs = wantDocs.filter((d) => !haveDocs.includes(d));
  if (missingDocs.length) notes.push(`no page renders for: ${missingDocs.join(", ")}`);
  for (const name of docs) {
    const [title, heading, blurb] = docCopy[name] ?? [name, name, ""];
    const style = name.startsWith("report_") ? name.slice("report_".length) : null;
    const extra = style && reports[style] ? `<a class="btn" href="../../reports/${slug}/${style}.html#audit">The audit and checks</a>` : "";
    // Start from an empty folder: a document that lost pages (a shorter
    // redraft) must not keep the old renders beside the new ones.
    rmSync(join(here, "exports", slug, "pages", name), { recursive: true, force: true });
    const pages = copyInto(join(pagesRoot, name), join(here, "exports", slug, "pages", name), /\.png$/).sort();
    const figures = pages
      .map((f, i) => `    <figure class="page"><img src="pages/${name}/${f}" alt="Page ${i + 1} of ${pages.length}" loading="${i < 2 ? "eager" : "lazy"}"><figcaption>Page ${i + 1} of ${pages.length}</figcaption></figure>`)
      .join("\n");
    const html = docTemplate
      .replace("%%THEME%%", theme)
      .replace("%%TITLE%%", title)
      .replaceAll("%%CASE_URL%%", caseUrl)
      .replaceAll("%%CASE_TITLE%%", esc(study.title))
      .replace("%%HEADING%%", heading)
      .replace("%%BLURB%%", blurb)
      .replace("%%PDF%%", `${name}.pdf`)
      .replace("%%EXTRA%%", extra)
      .replace("%%PAGES%%", figures);
    pageHoles.push(...unfilled(html));
    write(join("exports", slug, `${name}.html`), document(`${title}, ${study.title}`, html));
  }

  // The study's own page: the shared shell plus this study's fragment.
  const shell = readFileSync(join(here, "case-study.template.html"), "utf8");
  const content = readFileSync(join(study.dir, "content.html"), "utf8");
  const pageTitle = study.pageTitle ?? `Case study: ${study.title}`;
  const page = withShots(
    shell.replace("%%THEME%%", theme).replace("%%TITLE%%", esc(pageTitle)).replace("%%CONTENT%%", () => content),
    "../",
  );
  const holes = [...new Set([...unfilled(page), ...pageHoles])];
  write(join("case-studies", `${slug}.html`), document(pageTitle, page));
  study.reportsBuilt = declaredReports.filter((s) => reports[s]);
  study.docsBuilt = docs;
  study.reportData = reports;
  study.shotFiles = shotFiles;
  summaries.push(
    `${slug}: ${shotFiles.length} shots, ${study.reportsBuilt.length} reports, ${docs.length} documents, unfilled: ${holes.length ? holes.join(",") : "none"}${notes.length ? `, notes: ${notes.join("; ")}` : ""}`,
  );
}

// ------------------------------------------------------------- home page

const featured = studies[0];
if (!featured) {
  console.error("no case study could be built; nothing to feature on the home page");
  process.exit(1);
}
const cards = studies
  .map((s) =>
    [
      `      <article class="case card">`,
      `        <a href="case-studies/${s.slug}.html"><img class="shot" src="shots/${s.slug}/${s.cover}" alt="${esc(s.title)}: the finished causal map"></a>`,
      `        <span class="eyebrow">${esc(s.sector)}</span>`,
      `        <h3>${esc(s.title)}</h3>`,
      `        <p>${esc(s.blurb)}</p>`,
      `        <div class="links"><a class="btn btn-primary" href="case-studies/${s.slug}.html">Walk through it</a></div>`,
      `      </article>`,
    ].join("\n"),
  )
  .join("\n");
const featuredShots = featured.shotFiles.reduce(
  (h, f) => h.split(`%%SHOT_${f.slice(0, 2)}%%`).join(`shots/${featured.slug}/${f}`),
  readFileSync(join(here, "index.template.html"), "utf8").replace("%%THEME%%", theme),
);
const index = featuredShots
  .replaceAll("%%FEATURED_TITLE%%", esc(featured.title))
  .replaceAll("%%FEATURED%%", featured.slug)
  .replace("%%CASE_CARDS%%", () => cards)
  .replace("%%STANDARD_META%%", meta(featured.reportData.standard))
  .replace("%%PRELIMINARY_META%%", meta(featured.reportData.preliminary))
  .replace("%%EXECUTIVE_META%%", meta(featured.reportData.executive));
write("index.html", index);

// ------------------------------------------- changelog, guide, manifest

const releases = JSON.parse(readFileSync(join(here, "changelog.json"), "utf8"));
const changeList = (label, items) =>
  items && items.length
    ? `        <div><span class="eyebrow">${label}</span><ul>\n${items.map((i) => `          <li>${i}</li>`).join("\n")}\n        </ul></div>`
    : "";
const releaseHtml = releases
  .map((r) =>
    [
      `    <div class="release">`,
      `      <div><span class="v">${r.version}</span><span class="d">${r.date}</span></div>`,
      `      <div class="parts">`,
      [changeList("Added", r.features), changeList("Fixed", r.fixes)].filter(Boolean).join("\n"),
      `      </div>`,
      `    </div>`,
    ].join("\n"),
  )
  .join("\n");
const changelog = readFileSync(join(here, "changelog.template.html"), "utf8").replace("%%THEME%%", theme).replace("%%RELEASES%%", releaseHtml);
write("changelog.html", document("Changelog", changelog));

const fragment = readFileSync(join(here, "guide-fragment.html"), "utf8");
const guide = readFileSync(join(here, "guide.template.html"), "utf8").replace("%%THEME%%", theme).replace("%%GUIDE%%", () => fragment);
write("guide.html", document("User Guide", guide));

writeFileSync(join(here, "build-manifest.json"), `${JSON.stringify(built.sort(), null, 2)}\n`);

const siteHoles = [...unfilled(index), ...unfilled(changelog), ...unfilled(guide)];
for (const line of summaries) console.log(line);
console.log(
  `site: index.html (featuring ${featured.slug}), changelog.html ${releases.length} releases, guide.html ${guide.length} chars, ${built.length} pages, unfilled: ${siteHoles.length ? siteHoles.join(",") : "none"}`,
);
