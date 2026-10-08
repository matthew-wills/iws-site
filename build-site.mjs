/**
 * Assemble the site pages from the templates.
 *
 * CONTACT ADDRESS: the one place to set it is the CONTACT_EMAIL constant
 * below (search for it). It is deliberately unset ("TBD"); never use a
 * personal address. While unset, "Talk to us" links go to the Organisation
 * card on the download page.
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
/** The product's name, suffixed onto every page title except the home
 *  page's, which is the name alone. The company (Synoptic) is the maker,
 *  named in the header wordmark and the footer, never as the product. */
const BRAND = "Investigation Workflow Suite (IWS)";
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
const document = (title, body, description) => {
  const withoutTitle = body.replace(/<title>[^<]*<\/title>\n?/, "");
  const desc = description ? `<meta name="description" content="${esc(description)}">\n` : "";
  const head = `<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n${desc}`;
  // The template opens with its <style>; the head closes after it and the
  // body opens, so the markup that follows lands where it should.
  return `${head}${withoutTitle.replace("</style>", "</style>\n</head>\n<body>")}\n</body>\n</html>\n`;
};
const unfilled = (html) => html.match(/%%[A-Z_0-9]+%%/g) ?? [];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The site's own header and footer, shared by every page. A template
 *  carries %%HEADER%% and %%FOOTER%%; `prefix` is the path back to the
 *  site root ("", "../" or "../../"), `current` the nav key of the page,
 *  and `links` the footer's own links as [href, label] pairs, written
 *  relative to the page. */
const NAV = [
  ["index.html", "Home", "home"],
  ["product.html", "Product", "product"],
  ["methodology.html", "Methodology", "methodology"],
  ["ai-security.html", "AI and security", "ai"],
  ["case-studies.html", "Case studies", "cases"],
  ["guide.html", "Documentation", "docs"],
  ["download.html", "Download", "download"],
];
const MAKER = "Investigation Workflow Suite (IWS) is made by Synoptic Safety Investigation Software.";
/** Where every "Talk to us" and "Contact us" link on the site goes: one
 *  address, set here once it is decided (plan-public-release.md, step 2).
 *  Until then the links point at the Organisation card on the download
 *  page and the build says so. */
const CONTACT_EMAIL = "";
const CONTACT_HREF = CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : "download.html#organisation";
if (!CONTACT_EMAIL) console.log("contact: no address set in build-site.mjs; Talk to us links point at download.html#organisation");
const header = (prefix, current) =>
  [
    `<header class="top">`,
    `  <div class="wrap">`,
    `    <a class="brand" href="${prefix}index.html" aria-label="Synoptic, home">`,
    `      <svg viewBox="0 0 28 28" aria-hidden="true"><rect x="1" y="1" width="26" height="26" rx="6" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="5" y="7" width="8" height="5" rx="1.5" fill="currentColor" opacity="0.85"/><rect x="15" y="16" width="8" height="5" rx="1.5" fill="currentColor"/><path d="M13 9.5h3.5v9H15" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    `      <span class="brand-text">Synoptic<span class="brand-tag">Safety investigation software</span></span>`,
    `    </a>`,
    `    <nav class="nav" aria-label="Site">`,
    ...NAV.map(([href, label, key]) => `      <a href="${prefix}${href}"${key === current ? ' aria-current="page"' : ""}>${label}</a>`),
    `    </nav>`,
    `  </div>`,
    `</header>`,
  ].join("\n");
const footer = (prefix, links = []) =>
  [
    `  <footer>`,
    `    <span class="legal">${MAKER}<br>© 2026 Synoptic Safety Investigation Software</span>`,
    `    <span>${[...links, [`${prefix}changelog.html`, "Changelog"]].map(([href, label]) => `<a href="${href}">${label}</a>`).join(" · ")}</span>`,
    `  </footer>`,
  ].join("\n");
const chrome = (html, prefix, current, links) => html.replace("%%HEADER%%", () => header(prefix, current)).replace("%%FOOTER%%", () => footer(prefix, links));
const meta = (r) =>
  r
    ? `${r.words.toLocaleString("en-AU")} words · ${r.runLog?.engine ?? "endpoint"} · ${r.runLog?.calls?.length ?? "?"} model calls · drafted ${new Date(r.runLog?.drafted_at ?? Date.now()).toLocaleDateString("en-AU")}`
    : "";
const words = (r) => (r ? `${r.words.toLocaleString("en-AU")} words` : "");
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
  report_standard: ["Final investigation report", "Final investigation report, as published", "The full report written to the application’s Word template and converted to PDF: cover, distribution list and the report as drafted, section by section from the record."],
  report_preliminary: ["Preliminary investigation report", "Preliminary investigation report, as published", "The interim report on the same template: what has been established so far and what is still open, with no findings."],
  report_executive: ["Executive briefing", "Executive briefing, as published", "The short report on the same template: the occurrence, what was found and what is being done, in a few pages of plain language for the people who decide."],
  report_atsb: ["Final investigation report, ATSB-inspired layout", "Final investigation report, ATSB-inspired layout, as published", "The final report arranged to the structure of published ATSB final reports, on the same template: summary, occurrence, context, safety analysis, findings, safety issues and actions."],
  report_ntsb: ["Final investigation report, NTSB-inspired layout", "Final investigation report, NTSB-inspired layout, as published", "The final report arranged to the structure of published NTSB reports, on the same template: factual information, analysis, conclusions carrying the findings, the probable cause and the contributing factors, then recommendations."],
  report_aaib: ["Final investigation report, AAIB-inspired layout", "Final investigation report, AAIB-inspired layout, as published", "The final report arranged to the structure of published AAIB reports, on the same template: synopsis, factual information, analysis, conclusions splitting causal from contributory factors, then safety action and recommendations."],
  eii_tables: ["Evidence and Argument Tables", "Evidence and Argument Tables, as published", "One table per object: each test’s result and confidence, the evidence recorded for and against it, and the investigator’s reasoning."],
  evidence_argument_tables: ["Evidence and Argument Tables", "Evidence and Argument Tables, as published", "One table per object: each test’s result and confidence, the evidence recorded for and against it, and the investigator’s reasoning."],
  source_pack: ["Source pack", "Investigation source pack", "Every source document this investigation worked from, in one file and in reading order: the safety report, the records and extracts, and the interview transcripts."],
};
/** The headings for a report style's page, keyed by the folder name the
 *  application's reports sit in. The labels match the covers the
 *  application prints: the standard style is the final investigation
 *  report, and the atsb, ntsb and aaib styles are the same final report
 *  in another organisation's published layout. */
const reportCopy = {
  standard: ["Final investigation report", "Final investigation report", "The full report: executive summary, event overview, analysis, findings summary and appendices, drafted section by section from the record."],
  preliminary: ["Preliminary investigation report", "Preliminary investigation report", "The interim report: what happened, what has been established so far, the risk exposure and the open lines of enquiry. No findings."],
  executive: ["Executive briefing", "Executive briefing", "The occurrence, the findings and the actions on a few pages for the people who decide."],
  atsb: ["Final investigation report, ATSB-inspired layout", "Final investigation report, ATSB-inspired layout", "The final report arranged to the structure of published ATSB final reports: summary, occurrence, context, safety analysis, findings, safety issues and actions."],
  ntsb: ["Final investigation report, NTSB-inspired layout", "Final investigation report, NTSB-inspired layout", "The final report arranged to the structure of published NTSB reports: factual information, analysis, conclusions carrying the findings, the probable cause and the contributing factors, then recommendations."],
  aaib: ["Final investigation report, AAIB-inspired layout", "Final investigation report, AAIB-inspired layout", "The final report arranged to the structure of published AAIB reports: synopsis, factual information, analysis, conclusions splitting causal from contributory factors, then safety action and recommendations."],
};

/** One line of purpose for each output in a study page's outputs block
 *  (%%OUTPUTS%%). Shared by every study; an entry in a study's meta.json
 *  may carry its own "purpose" instead. */
const outputPurpose = {
  evidence_argument_tables: "The working behind every finding, one table per object in the order the map reads: each test’s result and confidence, the argument for and against, and the investigator’s reasoning.",
  report_preliminary: "The interim report, issued while the work is still running: what is known, what is still being looked at and what has already been done. It carries no findings.",
  report_standard: "The full internal report: an executive summary, the occurrence, the analysis lane by lane, the findings and the appendices a reviewer will ask for.",
  report_executive: "A few pages in plain language for the people who decide: what happened, why it happened, what was found and what is being done about it.",
};
/** The final report in another organisation's published layout, for the
 *  layouts table (%%LAYOUTS%%): the short name, and how it differs from
 *  the standard final report, taken from each style's own Purpose line. */
const layoutCopy = {
  atsb: ["ATSB-inspired", "Written for a readership outside the organisation: an investigation summary first, the findings on the seven-term scale, then the safety issues with the action taken against each."],
  ntsb: ["NTSB-inspired", "Factual information, analysis and conclusions, ending in a single probable cause statement with its contributing factors, then the recommendations."],
  aaib: ["AAIB-inspired", "A synopsis first, and conclusions that split the causal factors from the contributory ones before the safety action and recommendations. Written in British English."],
};
const LAYOUTS_NOTE =
  "These layouts follow the published report structure of the Australian Transport Safety Bureau, the US National Transportation Safety Board and the UK Air Accidents Investigation Branch. They are not produced, reviewed or endorsed by those organisations.";

/** A study page's outputs block, from meta.json's "outputs": each entry
 *  names a document and the page shown as its preview, so a preview is
 *  always a page the application generated. Paths are relative to
 *  case-studies/<slug>.html. */
const outputsBlock = (study, pagesRoot, reports, notes) => {
  const { slug } = study;
  const items = (study.outputs ?? []).map((o) => {
    const doc = o.doc;
    const pageFiles = existsSync(join(pagesRoot, doc)) ? readdirSync(join(pagesRoot, doc)).filter((f) => /^p\d+\.png$/.test(f)).sort() : [];
    const pageFile = `p${String(o.page).padStart(2, "0")}.png`;
    if (!pageFiles.includes(pageFile)) notes.push(`outputs: ${doc} has no ${pageFile}`);
    const label = (docCopy[doc] ?? [doc])[0];
    const style = doc.startsWith("report_") ? doc.slice("report_".length) : null;
    const read = style && reports[style] ? `<a class="btn btn-primary" href="../reports/${slug}/${style}.html">Read</a>` : "";
    const view = `<a class="btn${read ? "" : " btn-primary"}" href="../exports/${slug}/${doc}.html">View pages</a>`;
    const pdf = `<a class="btn" href="../exports/${slug}/${doc}.pdf" target="_blank" rel="noopener">PDF</a>`;
    const shown = o.caption ? `page ${o.page} shown: ${esc(o.caption)}` : `page ${o.page} shown`;
    return [
      `      <article class="output">`,
      `        <a class="output__page" href="../exports/${slug}/${doc}.html"><img src="../exports/${slug}/pages/${doc}/${pageFile}" alt="Page ${o.page} of the ${esc(label)}" loading="lazy"></a>`,
      `        <div class="output__body">`,
      `          <h3>${esc(label)}</h3>`,
      `          <p>${esc(o.purpose ?? outputPurpose[doc] ?? "")}</p>`,
      `          <p class="output__meta">${pageFiles.length} pages · ${shown}</p>`,
      `          <div class="links">${read}${view}${pdf}</div>`,
      `        </div>`,
      `      </article>`,
    ].join("\n");
  });
  return items.length ? `    <div class="outputs">\n${items.join("\n")}\n    </div>` : "";
};
/** The layouts table, from meta.json's "layouts" (the atsb, ntsb and aaib
 *  report folders): the same final report in other published layouts. */
const layoutsBlock = (study, reports) => {
  const { slug } = study;
  const rows = (study.layouts ?? [])
    .filter((style) => reports[style])
    .map((style) => {
      const [name, line] = layoutCopy[style] ?? [style, ""];
      return `        <tr><th scope="row">${esc(name)}</th><td>${esc(line)}</td><td class="layouts__links"><a href="../reports/${slug}/${style}.html">Read</a> · <a href="../exports/${slug}/report_${style}.pdf" target="_blank" rel="noopener">PDF</a></td></tr>`;
    });
  if (!rows.length) return "";
  return [
    `    <table class="layouts">`,
    `      <thead><tr><th scope="col">Layout</th><th scope="col">How it differs</th><th scope="col">Open</th></tr></thead>`,
    `      <tbody>`,
    ...rows,
    `      </tbody>`,
    `    </table>`,
    `    <p class="layouts__note">${esc(LAYOUTS_NOTE)}</p>`,
  ].join("\n");
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
  const studyLinks = [[`${caseUrl}#published`, "Back to the case study"], ["../../case-studies.html", "All case studies"]];

  // A page per report style: the report as drafted, with the grounding
  // audit, the mechanical record check and the review notes beside it.
  const reportTemplate = readFileSync(join(here, "report.template.html"), "utf8");
  const markdownCss = existsSync(join(reportsOut, "markdown.css")) ? readFileSync(join(reportsOut, "markdown.css"), "utf8") : "";
  const pageHoles = [];
  for (const style of declaredReports.filter((s) => reports[s])) {
    const r = reports[style];
    const [title, heading, blurb] = reportCopy[style] ?? [style, style, ""];
    const html = chrome(reportTemplate, "../../", "cases", studyLinks)
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
    write(join("reports", slug, `${style}.html`), document(`${title}, ${study.title} | ${BRAND}`, html, blurb));
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
    const html = chrome(docTemplate, "../../", "cases", studyLinks)
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
    write(join("exports", slug, `${name}.html`), document(`${title}, ${study.title} | ${BRAND}`, html, blurb));
  }

  // The study's own page: the shared shell plus this study's fragment. A
  // study held at an older version (meta.json's optional "note") gets that
  // note rendered where its content.html carries %%VERSION_NOTE%%; a study
  // with neither just drops the placeholder.
  const shell = readFileSync(join(here, "case-study.template.html"), "utf8");
  const versionNote = study.note ? `<p class="note">${esc(study.note)}</p>` : "";
  const content = readFileSync(join(study.dir, "content.html"), "utf8")
    .replace("%%VERSION_NOTE%%", () => versionNote)
    .replace("%%OUTPUTS%%", () => outputsBlock(study, pagesRoot, reports, notes))
    .replace("%%LAYOUTS%%", () => layoutsBlock(study, reports));
  const pageTitle = study.pageTitle ?? `Case study: ${study.title}`;
  const page = withShots(
    chrome(shell, "../", "cases", [["../case-studies.html", "All case studies"], ["../download.html", "Download"], ["#top", "Back to top"]])
      .replace("%%THEME%%", theme).replace("%%TITLE%%", esc(pageTitle)).replace("%%CONTENT%%", () => content),
    "../",
  );
  const holes = [...new Set([...unfilled(page), ...pageHoles])];
  write(join("case-studies", `${slug}.html`), document(`${pageTitle} | ${BRAND}`, page, study.blurb));
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
      `        <a href="case-studies/${s.slug}.html"><img class="photo" src="case-studies/${s.slug}/${s.photo}" alt="${esc(s.photoAlt ?? "")}" width="1200" height="800" loading="lazy" decoding="async"></a>`,
      `        <span class="eyebrow">${esc(s.sector)}${s.occurrence ? ` · ${esc(s.occurrence)}` : ""}</span>`,
      `        <h3>${esc(s.title)}</h3>`,
      `        <p>${esc(s.blurb)}</p>`,
      `        <div class="links"><a class="btn btn-primary" href="case-studies/${s.slug}.html">Walk through it</a></div>`,
      `      </article>`,
    ].join("\n"),
  )
  .join("\n");
/** The featured study's Evidence and Argument Tables, under whichever
 *  name its exports carry (a study not yet re-drafted has the older one). */
const featuredTables = (featured.docsBuilt ?? []).find((d) => d === "evidence_argument_tables" || d === "eii_tables") ?? "evidence_argument_tables";
/** The top-level pages are filled from the same featured study: its
 *  screenshots, its slug, the case cards and its reports. */
const fillFeatured = (templateName, current) =>
  featured.shotFiles
    .reduce(
      (h, f) => h.split(`%%SHOT_${f.slice(0, 2)}%%`).join(`shots/${featured.slug}/${f}`),
      chrome(readFileSync(join(here, templateName), "utf8"), "", current, [["#top", "Back to top"]]).replace("%%THEME%%", theme),
    )
    .replaceAll("%%CONTACT%%", CONTACT_HREF)
    .replaceAll("%%FEATURED_TABLES%%", featuredTables)
    .replaceAll("%%FEATURED_KIND%%", esc([featured.sector, featured.occurrence].filter(Boolean).join(" · ")))
    .replaceAll("%%FEATURED_TITLE%%", esc(featured.title))
    .replaceAll("%%FEATURED%%", featured.slug)
    .replace("%%CASE_CARDS%%", () => cards)
    .replace("%%STANDARD_META%%", meta(featured.reportData.standard))
    .replace("%%PRELIMINARY_META%%", meta(featured.reportData.preliminary))
    .replace("%%EXECUTIVE_META%%", meta(featured.reportData.executive))
    .replace("%%STANDARD_WORDS%%", words(featured.reportData.standard))
    .replace("%%PRELIMINARY_WORDS%%", words(featured.reportData.preliminary))
    .replace("%%EXECUTIVE_WORDS%%", words(featured.reportData.executive));
const index = fillFeatured("index.template.html", "home");
write("index.html", index);
/** The other top-level pages: template, nav key, title and description. */
const sitePages = [
  ["product", "Product", "Investigation Workflow Suite (IWS) keeps the checklist, evidence, interviews, timeline, causal map, tests, findings and reports in one connected investigation record."],
  ["methodology", "Methodology", "How Investigation Workflow Suite (IWS) moves from evidence to tested propositions to findings, with the Existence, Influence and Importance tests, a standard of proof set for each investigation and a ten-term probability scale."],
  ["ai-security", "AI and security", "What AI drafting does in Investigation Workflow Suite (IWS), how drafts are checked against the investigation record, and where investigation data goes under each AI access setting, and how to bring your own AI."],
  ["case-studies", "Case studies", "Fictional safety investigations in aviation, maritime and mining, worked from first notification to final report in Investigation Workflow Suite (IWS)."],
  ["download", "Download", "Download Investigation Workflow Suite (IWS) for Windows 10 and 11: the Free, Professional and Organisation levels, the 90-day Professional trial, and how to buy and activate a licence."],
  ["getting-started", "Getting started", "The first investigation in Investigation Workflow Suite (IWS), step by step, from a new investigation folder to the first report."],
];
const navKey = { product: "product", methodology: "methodology", "ai-security": "ai", "case-studies": "cases", download: "download", "getting-started": null };
const topPages = sitePages.map(([name, title, description]) => {
  const html = fillFeatured(`${name}.template.html`, navKey[name]);
  write(`${name}.html`, document(`${title} | ${BRAND}`, html, description));
  return html;
});

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
const changelog = chrome(readFileSync(join(here, "changelog.template.html"), "utf8"), "", null, [["download.html", "Download"]]).replace("%%THEME%%", theme).replace("%%RELEASES%%", releaseHtml);
write("changelog.html", document(`Changelog | ${BRAND}`, changelog, "What changed in Investigation Workflow Suite (IWS), release by release."));

const fragment = readFileSync(join(here, "guide-fragment.html"), "utf8");
const guide = chrome(readFileSync(join(here, "guide.template.html"), "utf8"), "", "docs", [["#top", "Back to top"]]).replace("%%THEME%%", theme).replace("%%GUIDE%%", () => fragment);
write("guide.html", document(`Documentation | ${BRAND}`, guide, "The Investigation Workflow Suite (IWS) user guide, the same guide the application ships under Help."));

writeFileSync(join(here, "build-manifest.json"), `${JSON.stringify(built.sort(), null, 2)}\n`);

const siteHoles = [...unfilled(index), ...topPages.flatMap(unfilled), ...unfilled(changelog), ...unfilled(guide)];
for (const line of summaries) console.log(line);
console.log(
  `site: index.html and ${sitePages.map(([n]) => `${n}.html`).join(", ")} (featuring ${featured.slug}), changelog.html ${releases.length} releases, guide.html ${guide.length} chars, ${built.length} pages, unfilled: ${siteHoles.length ? siteHoles.join(",") : "none"}`,
);
