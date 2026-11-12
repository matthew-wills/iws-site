/**
 * The site's one configuration file: business details, what the site may do,
 * and the wording that has to be identical wherever it appears.
 *
 * build-site.mjs imports this and fills the holes in the templates. No
 * sentence below is typed into a template. Design:
 * the design of 12/11/2026 (website-fixes-13-11/design.md, section 2).
 */

/** Business details. Every value is null until Matthew supplies it.
 *  Filling this object is the whole job: nothing else on the site names
 *  the company, its ABN, an address or a legal document. */
export const BUSINESS = {
  legalName: null, // expected: "Synoptic Software Pty Ltd"
  businessName: null, // expected: "Synoptic Safety Investigation Software"
  abn: null, // the company's ABN, after the business name transfer
  acn: null, // optional
  registeredOffice: null, // optional; a suburb and state is enough
  contactEmail: null, // general contact; where "Talk to us" and "Contact us" go
  supportEmail: null, // optional; falls back to contactEmail
  salesEmail: null, // optional; Organisation enquiries; falls back to contactEmail
  domain: null, // e.g. "example.com.au", no scheme, no slash
  // Decision D8: the privacy notice and licence terms are pages on this site (privacy.html, terms.html) at go-live.
  eulaUrl: null, // the Professional licence terms (page on this site, or a PDF)
  educationEulaUrl: null, // the Education licence terms (#1237)
  privacyUrl: null, // the privacy notice (#1237)
  trialDataRetention: null, // one sentence from the privacy notice: how long trial details are kept, and where
  paymentContact: null, // one sentence: how to pay and who to contact; null while pricing is unpublished
  copyrightYear: 2026,
};

/** What the site is allowed to do. Each switch is flipped at go-live,
 *  in the go-live commit, never before. The build refuses a switch that is
 *  on while the business details it depends on are missing. */
export const LAUNCH = {
  indexable: false, // false: every page carries noindex (decision D3, audit M10)
  version: null, // e.g. "1.0.0" at release; null shows no version
  installerFile: null, // the installer's file name at release
  installerUrl: null, // where Download IWS goes
  checksumsUrl: null, // SHA256SUMS.txt
  trialOpen: false, // true only when the licence server is live
  educationOpen: false, // true only when Education licences can be issued
  pricePublished: false, // decision D2: keep "Pricing to be announced"
};

/** Licence details that are not settled (Matthew, 13/11/2026: "pricing is
 *  still to be fully determined"; the levels are Education, Professional with
 *  a trial, and Organisation). Every value is null until decided, and the page
 *  then shows a "To be confirmed" placeholder, never a guess. No price lives
 *  here: every price reads "Pricing to be announced" (decision D2). */
export const LICENCE_OPEN = {
  educationScope: null, // what Education includes beyond the 11/11 decisions (full workspace, tables and Word reports, no AI)
  trialLength: null, // how long the Professional trial runs, e.g. "30 days"
  organisationSales: null, // how Organisation is sold and supported
};

/** Shown under the three cards as a plain line, not a fourth plan. */
// D1-free: confirm with Matthew
export const NO_LICENCE_LINE =
  "Without a licence, IWS opens as read-only. You can open and read any investigation and export what it already holds, with no time limit. Creating, editing and saving need a licence.";

/** The shared wording (decisions D4, D5, D6). Used whole, never retyped.
 *  Once the app carries the same constants (issues #1274 and #1271), compare
 *  these with the app's text at each release. */
export const WORDING = {
  // Decision D4: wording approved for the site now.
  aiResponsibility:
    "We have done our best to make AI drafting accurate, but a model can be wrong. Whatever it generates is a first draft. The investigator checks it against the record and signs it off as true and correct before it is used.",
  // Decision D4. Shown in full once, on the AI and security page (id="names").
  namesStatement: [
    "IWS is designed to keep people's names away from a model. Transcript speakers and interview attendees are sent by role. A person on the investigation's People list is swapped for their role in every prompt, and IWS lists the names it finds in the interviews so you can decide each one.",
    'These are safeguards and they have limits. A name IWS has not been told about, or one typed where it does not look, is sent as written, and a small number of actions send names as written and say so. The investigator is responsible for checking every prompt before it is sent and every output before it is used. <a href="guide.html#manual-draft-sent">What is sent to a model, and what never is</a> lists exactly what goes.',
  ],
  namesLink: "How names are kept from a model, and what you still check",
  // Decision D5: "a frontier model" in place of the vendor's name.
  frontierModel: "a frontier model",
  // Decision D6: the dated note now, full regeneration at release.
  guideStaleNote:
    'This copy was produced for an earlier pre-release build. Since then the AI access settings have been renamed (No AI, Copy and paste, Connected AI), new files are saved as .iwsx, an organisation\'s own Word template has moved to the Organisation level, and the handling of names has changed. It is replaced with the current guide at the public release. Where this copy and the <a href="ai-security.html">AI and security</a> or <a href="download.html#pricing">Download</a> pages disagree, those pages are right.',
};

/** The licence levels, as data, so the Download cards and any short line
 *  elsewhere read the same facts. Rendered by build-site.mjs.
 *  Decision D1 (read-only Free, Education), D7 (Education button is a launch
 *  placeholder), D10 (no Professional branding on the card until #1235). */
export const LICENCE_LEVELS = [
  {
    id: "education",
    name: "Education",
    heading: "Learn the method",
    price: "Pricing to be announced",
    priceIsText: true,
    priceNote: "For students and teaching staff. 12 months, renewable.",
    line: "The full investigation analysis for study and teaching, with no AI.",
    points: [
      "The complete investigation workspace: the AcciMap, every factor tested for Existence, Influence and Importance, evidence, interviews and the timeline",
      "Evidence and Argument Tables and Word reports, each labelled “Prepared under an education licence, not for operational use”",
      "No AI drafting",
      "%%TBC_EDUCATION_SCOPE%%",
    ],
    notes: ["For study and teaching only, never for an operational investigation. Requested with the email address your education provider gave you."],
    // Decision D7: a disabled launch placeholder until Education is open.
    action: { label: "Request an Education licence", primary: false, kind: "education" },
    footNote: '<a href="organisations.html#training">IWS for study and teaching</a>',
  },
  {
    id: "professional",
    name: "Professional",
    heading: "Complete the investigation",
    price: "Pricing to be announced",
    priceIsText: true,
    priceNote: "We're gauging interest and the support Professional users will need before we set a price.",
    line: "Standardised software for the working investigator, from the evidence to the finished report.",
    points: [
      "The complete investigation workspace, with nothing labelled",
      "Finished Word reports and executive briefing slides, in the built-in report types and looks",
      "Optional AI-assisted drafting, by copy and paste or through a connected AI service you supply",
      "A trial before you commit: %%TBC_TRIAL_LENGTH%%",
    ],
    notes: [
      'AI service and model costs are not included. You connect your own suitable AI; see <a href="ai-security.html#your-ai">bring your own AI</a>.',
      "%%AI_RESPONSIBILITY%%",
    ],
    lead: true,
    action: { label: "Start a Professional trial", primary: true, kind: "trial" },
    footNote: '<a href="#trial">About the trial</a> · <a href="#buy">About pricing</a>',
  },
  {
    id: "organisation",
    name: "Organisation",
    heading: "Configured for your organisation",
    price: "Pricing to be announced",
    priceIsText: true,
    priceNote: "%%TBC_ORGANISATION_SALES%%",
    line: "IWS configured and supported for the way your organisation investigates, rather than your investigators working around the software.",
    points: [
      "Everything in Professional",
      "Your investigation framework, terminology, checklists and report templates, configured for you",
      "Your organisation's own Word template for every document IWS writes",
      "Where needed, a findings map built on your own taxonomy",
      "Configuration and support as agreed in writing",
    ],
    notes: [],
    action: { label: "Talk to us", primary: false, kind: "contact" },
    footNote: '<a href="organisations.html">More about organisation editions</a>',
  },
];
