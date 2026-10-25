#!/usr/bin/env node
/**
 * Builds the Pharmodry role-based user manuals.
 *
 *   npm run manuals:build          (after npm run manuals:capture)
 *
 * Inputs : SOURCES/modules.mjs, SOURCES/roles.mjs, SCREENSHOTS/manifest.json (genuine screenshots),
 *          role permissions from packages/types (the same definitions the server enforces).
 * Outputs: MANUAL_SOURCES/<role>_manual.md and .html, PDF/NN_<Role>_User_Manual.pdf,
 *          ROLE_AND_PERMISSION_CATALOG.md, SCREENSHOT_INVENTORY.md.
 * PDFs are rendered with Playwright (Chromium engine, system Microsoft Edge by default; PW_CHANNEL=chromium
 * to use a downloaded Chromium).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MODULES, GENERAL, STATUS_MEANINGS } from './modules.mjs';
import { ROLE_MANUALS, DEFERRED_ROLES } from './roles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '../..');
const require = createRequire(import.meta.url);
const types = require(resolve(repo, 'packages/types/dist/index.js'));
const { chromium } = require(resolve(repo, 'node_modules/playwright'));

// Pharmodry brand assets (docs/BRAND). Inlined so PDFs are self-contained.
const BRAND = { name: 'Pharmodry', line: 'Precision in Every Batch.', navy: '#0B1E3F', cobalt: '#1F4FCC', cyan: '#0B93A3', slate: '#52607A', mist: '#EAF0FC' };
const LOGO_SVG = readFileSync(resolve(repo, 'docs/BRAND/logo/pharmodry-logo.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
const MARK_DATA_URI = 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(resolve(repo, 'docs/BRAND/logo/pharmodry-mark.svg'))).toString('base64');
const VERSION = JSON.parse(readFileSync(resolve(repo, 'package.json'), 'utf8')).version;
const DOC_VERSION = '1.0';
const today = new Date().toISOString().slice(0, 10);
/** Merge the per-test capture fragments (SCREENSHOTS/_parts/*.json) into SCREENSHOTS/manifest.json. */
function loadManifest() {
  const partsDir = resolve(root, 'SCREENSHOTS/_parts');
  if (existsSync(partsDir)) {
    const parts = readdirSync(partsDir).filter((f) => f.endsWith('.json') && f !== 'ids.json').sort();
    if (parts.length) {
      const merged = { generatedAt: '', baseURL: '', viewport: '', roles: {}, shots: [], failures: [], parts };
      for (const f of parts) {
        const m = JSON.parse(readFileSync(resolve(partsDir, f), 'utf8'));
        merged.generatedAt = merged.generatedAt && merged.generatedAt > m.generatedAt ? merged.generatedAt : m.generatedAt;
        merged.baseURL = m.baseURL;
        merged.viewport = m.viewport;
        Object.assign(merged.roles, m.roles);
        merged.shots.push(...m.shots);
        merged.failures.push(...m.failures);
      }
      writeFileSync(resolve(root, 'SCREENSHOTS/manifest.json'), JSON.stringify(merged, null, 2));
    }
  }
  return JSON.parse(readFileSync(resolve(root, 'SCREENSHOTS/manifest.json'), 'utf8'));
}
const manifest = loadManifest();
const shotIndex = new Map(); // `${role}/${name}` -> shot
for (const s of manifest.shots) shotIndex.set(`${s.role}/${s.name}`, s);
const roleTitle = Object.fromEntries(ROLE_MANUALS.map((r) => [r.slug, r.title]));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const permsOf = (code) => new Set(types.DEFAULT_ROLES.find((r) => r.code === code).permissions);
const hasAny = (perms, list) => !list || list.length === 0 || list.some((p) => perms.has(p));
const permDesc = types.PERMISSIONS;

/** The main GMP flow and who performs each step (permission). */
const FLOW = [
  ['Raise purchase order', 'procurement.po.create'],
  ['Approve purchase order (different person)', 'procurement.po.approve'],
  ['Receive goods (GRN) → lots in QUARANTINE, QC sample requested', 'inventory.receive'],
  ['Collect sample and enter results', 'qc.result.enter'],
  ['Review results (different person)', 'qc.result.review'],
  ['Approve QC sample (e-signature)', 'qc.result.approve'],
  ['QA disposition of material lot (e-signature)', 'inventory.release'],
  ['Create / approve production plan', 'production.plan.manage'],
  ['Create batch', 'batch.create'],
  ['Reserve materials (FEFO, released lots only)', 'batch.reserve'],
  ['Issue materials to production', 'inventory.issue'],
  ['Start batch', 'batch.start'],
  ['Execute and sign eBMR steps', 'batch.execute'],
  ['Verify eBMR steps (different person, e-signature)', 'batch.verify'],
  ['Complete manufacturing (yield, FG to QUARANTINE)', 'batch.complete'],
  ['Finished-product QC (enter / review / approve)', 'qc.result.enter'],
  ['QA batch release or rejection (e-signature)', 'batch.approve'],
  ['Raise deviation', 'deviation.create'],
  ['Investigate deviation / OOS', 'deviation.investigate'],
  ['Classify, approve and close deviations', 'deviation.approve'],
  ['Conclude OOS (e-signature)', 'oos.approve'],
  ['Create and manage CAPA', 'capa.create'],
  ['Close CAPA (e-signature)', 'capa.close'],
];

const REPORTS = [
  ['Batch summary (CSV)', 'batch.view', 'Reports → Batch summary'],
  ['Batch manufacturing record (print / PDF)', 'batch.view', 'Batch page → Batch record'],
  ['Inventory status (CSV)', 'inventory.view', 'Reports or Inventory → Export CSV'],
  ['Near-expiry inventory (CSV)', 'inventory.view', 'Reports or Inventory → Expiry intelligence'],
  ['Expired stock (CSV)', 'inventory.view', 'Reports'],
  ['Deviation register (CSV)', 'deviation.view', 'Deviations → Export CSV'],
  ['CAPA register (CSV)', 'capa.view', 'CAPA → Export CSV'],
  ['OOS register (CSV)', 'oos.view', 'OOS investigations → Export CSV'],
  ['QC summary (CSV)', 'qc.view', 'QC samples → Export CSV'],
  ['Supplier performance (CSV)', 'supplier.view', 'Suppliers → Export CSV'],
  ['Mock-recall reconciliation (CSV)', 'batch.view', 'Traceability & recall → Export recall reconciliation'],
  ['Product Quality Review data pack (print / PDF)', 'analytics.view', 'Product quality review → Print / PDF'],
  ['Audit trail (CSV)', 'audit.export', 'Audit trail → Export'],
];

function buildManual(role) {
  const perms = permsOf(role.code);
  const nav = manifest.roles[role.slug]?.nav ?? [];
  const mods = MODULES.filter((m) => hasAny(perms, m.view) && (!m.viewAll || m.viewAll.every((p) => perms.has(p))));
  let fig = 0;
  const figures = [];
  const md = [];
  const html = [];
  const chapters = [];
  const H = (n, t) => {
    const id = `c${chapters.length + 1}`;
    chapters.push({ id, n, t });
    md.push(`\n## ${n}. ${t}\n`);
    html.push(`<h1 id="${id}" class="chapter"><span class="num">${n}</span> ${esc(t)}</h1>`);
  };
  const h2 = (t) => { md.push(`\n### ${t}\n`); html.push(`<h2>${esc(t)}</h2>`); };
  const p = (t) => { md.push(`${t}\n`); html.push(`<p>${esc(t)}</p>`); };
  const ul = (items) => { md.push(items.map((i) => `- ${i}`).join('\n') + '\n'); html.push(`<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`); };
  const ol = (items) => { md.push(items.map((i, k) => `${k + 1}. ${i}`).join('\n') + '\n'); html.push(`<ol class="steps">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`); };
  const table = (head, rows, cls = '') => {
    md.push(`| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '/')).join(' | ')} |`).join('\n')}\n`);
    html.push(`<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  };
  const callout = (kind, title, text) => { md.push(`> **${title}** ${text}\n`); html.push(`<div class="callout ${kind}"><b>${esc(title)}</b> ${esc(text)}</div>`); };
  const figure = (name, { allowOther = false } = {}) => {
    let s = shotIndex.get(`${role.slug}/${name}`);
    let other = '';
    if (!s && allowOther) {
      s = manifest.shots.find((x) => x.name === name);
      if (s) other = s.role === 'common' ? '' : ` (screen captured while signed in as ${roleTitle[s.role] ?? s.role})`;
    }
    if (!s) return false;
    if (figures.some((f) => f.file === s.file)) return true;
    fig += 1;
    figures.push({ n: fig, file: s.file, caption: s.caption });
    // Annotated copy (numbered callouts) when one was captured; the clean original stays in SCREENSHOTS.
    const rel = `../SCREENSHOTS/${s.annotated ?? s.file}`;
    const legend = s.annotated && s.legend?.length ? s.legend : null;
    md.push(`![Figure ${fig}](${rel})\n\n*Figure ${fig} — ${s.title}. ${s.caption}${other}*\n` + (legend ? `\n${legend.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n` : ''));
    html.push(
      `<figure><img src="${rel}" alt="${esc(s.title)}"/><figcaption><b>Figure ${fig} — ${esc(s.title)}.</b> ${esc(s.caption + other)}` +
        (legend ? `<ol class="legend">${legend.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : '') +
        `</figcaption></figure>`,
    );
    return true;
  };

  // ---------- Cover ----------
  html.push(`<section class="cover">
    <div class="band"></div>
    <div class="brand">${LOGO_SVG}</div>
    <div class="kicker">Pharmaceutical operations, quality &amp; compliance platform</div>
    <div class="title">${esc(role.title)}<br/>User Manual</div>
    <div class="aud"><b>Intended audience:</b> ${esc(role.audience)}</div>
    <table class="meta"><tr><td>Product</td><td>Pharmodry ${esc(VERSION)} (MVP release) — ${BRAND.line}</td></tr>
    <tr><td>Manual</td><td>${esc(role.no)} — ${esc(role.title)} User Manual</td></tr>
    <tr><td>Document version</td><td>${DOC_VERSION}</td></tr>
    <tr><td>Generated</td><td>${today} from the running application (screenshots captured ${esc(manifest.generatedAt.slice(0, 10))})</td></tr>
    <tr><td>Role code</td><td>${esc(role.code)}</td></tr></table>
    <div class="disclaimer">Screenshots show fictional demonstration data (NovaCure Pharmaceuticals). Pharmodry is not a validated system; procedures in this manual describe the software and must be used within your company’s approved SOPs.</div>
  </section>`);
  md.push(`# Pharmodry — ${role.title} User Manual\n\n- Product: Pharmodry ${VERSION} (MVP release)\n- Intended audience: ${role.audience}\n- Document version: ${DOC_VERSION}\n- Generated: ${today} (screenshots captured ${manifest.generatedAt.slice(0, 10)})\n- Role code: ${role.code}\n\n> Screenshots show fictional demonstration data. Pharmodry is not a validated system; use within your approved SOPs.\n`);
  const tocAt = html.length;
  html.push('<!--TOC-->');
  md.push('<!--TOC-->');

  // 1 Purpose and scope
  H(1, 'Purpose and scope');
  p(role.purpose);
  p(`This manual covers every Pharmodry screen available to the ${role.title} role in release ${VERSION}. Your exact access is set by your company’s administrator; if your account has additional roles or a site restriction, you may see more or fewer options than described. Configuration-dependent behaviour (for example tolerances, aging thresholds, calibration policy, AI availability) is marked as such.`);
  callout('warn', 'Not available in this release:', 'Pharmacovigilance, sales/distribution and accounting modules; customer-level distribution in recalls; e-mail notifications; serial-number management; MFA/single sign-on. These are not described as working anywhere in this manual.');

  // 2 Responsibilities
  H(2, 'Role responsibilities');
  ul(role.responsibilities);
  h2('Dependencies on other departments');
  ul(role.dependencies);

  // 3 Login / logout
  H(3, 'Signing in and signing out');
  ol(GENERAL.login);
  figure('login', { allowOther: true });
  figure('profile');

  // 4 Dashboard overview
  H(4, 'Home page and dashboard overview');
  p(MODULES.find((m) => m.id === 'home').overview);
  figure('my_work');
  for (const id of ['command_center', 'dashboard']) {
    const m = MODULES.find((x) => x.id === id);
    if (hasAny(perms, m.view)) { h2(m.title); p(m.overview); figure(m.shots[0]); }
  }
  if (!hasAny(perms, ['analytics.view', 'commandcenter.view'])) p('Your role has no dashboard or Command Center access; My work is your starting point.');

  // 5 Navigation
  H(5, 'Navigation and module overview');
  ul(GENERAL.navigation);
  p(`The sidebar below was recorded from the application while signed in as the demo ${role.title} (${manifest.roles[role.slug]?.email ?? ''}).`);
  table(['Sidebar group', 'Menu entry', 'Address'], nav.map((n) => [n.group, n.label, n.href]));

  // 6 Features and procedures
  H(6, 'Features and step-by-step instructions');
  p('Each section explains a module you can open, the procedures you are allowed to perform (numbered steps) and screenshots of the real screens. Procedures that need permissions your role does not hold are listed under “Not available to your role”.');
  const restrictedProcs = [];
  for (const m of mods) {
    if (m.id === 'home' || m.id === 'command_center' || m.id === 'dashboard') continue;
    h2(m.title);
    p(m.overview);
    for (const n of m.notes ?? []) callout('info', 'Note:', n);
    const tourShots = (m.shots ?? []).filter((s) => !s.startsWith('wf_'));
    for (const s of tourShots) figure(s);
    const allowed = (m.procedures ?? []).filter((pr) => hasAny(perms, pr.perm));
    const denied = (m.procedures ?? []).filter((pr) => !hasAny(perms, pr.perm));
    for (const pr of allowed) {
      md.push(`\n#### ${pr.title}\n`);
      html.push(`<h3>${esc(pr.title)}</h3>`);
      ol(pr.steps);
      for (const s of pr.shots ?? []) if (s.startsWith('wf_')) figure(s, { allowOther: true });
    }
    if (denied.length) {
      const items = denied.map((d) => `${d.title} — requires ${d.perm.join(' or ')}`);
      restrictedProcs.push(...items.map((i) => `${m.title}: ${i}`));
      callout('muted', 'Not available to your role:', items.join('; ') + '.');
    }
  }

  // 7 Fields
  H(7, 'Field-by-field explanations, required inputs and validation rules');
  p('General rules: required fields are marked; dates use the date picker; numbers must be positive unless stated; reasons must be at least 5 characters; unknown or malformed inputs are rejected by the server. Forms that you cannot submit are still shown for reference where you can view the module.');
  let anyFields = false;
  for (const m of mods) {
    if (!m.fields) continue;
    const canAct = (m.procedures ?? []).some((pr) => pr.perm && hasAny(perms, pr.perm));
    if (!canAct) continue;
    anyFields = true;
    h2(m.title);
    table(['Field', 'Required', 'Rules and meaning'], m.fields);
  }
  if (!anyFields) p('Your role does not create or edit records in modules with data-entry forms (read-only or approval-only access); the screens you use are explained in chapter 6.');

  // 8 Buttons
  H(8, 'Buttons and their functions');
  const btnRows = [];
  for (const m of mods) for (const [b, perm, does] of m.buttons ?? []) btnRows.push([m.title.split(':')[0], b, does, perm && !perms.has(perm) ? `No (needs ${perm})` : 'Yes']);
  table(['Module', 'Button', 'What it does', 'Available to you'], btnRows, 'small');
  p('Buttons you cannot use are hidden or disabled in the application; the server refuses the action even if attempted another way.');

  // 9 Workflow and approvals
  H(9, 'Workflow, approvals and electronic signatures');
  p('The table shows the main GMP workflow and where your role takes part. Segregation of duties is enforced by the server: the person who performs a step cannot review, verify or approve it.');
  table(['Workflow step', 'Permission', 'Your role'], FLOW.map(([s, perm]) => [s, perm, perms.has(perm) ? 'You perform this' : '—']));
  h2('Electronic signatures');
  ul(GENERAL.signatures);
  for (const n of ['wf_sample_approve_signature', 'wf_lot_release_signature', 'wf_batch_release_signature', 'wf_ebmr_verify_signature']) {
    const needs = { wf_sample_approve_signature: 'qc.result.approve', wf_lot_release_signature: 'inventory.release', wf_batch_release_signature: 'batch.approve', wf_ebmr_verify_signature: 'batch.verify' }[n];
    if (perms.has(needs)) { figure(n, { allowOther: true }); break; }
  }

  // 10 Statuses
  H(10, 'Status meanings');
  const st = new Set();
  for (const m of mods) for (const s of m.statuses ?? []) st.add(s);
  table(['Status', 'Meaning'], [...st].map((s) => [s.replace(/_/g, ' '), STATUS_MEANINGS[s] ?? '']));

  // 11 Search, filters
  H(11, 'Search, filters, sorting and pagination');
  ul(GENERAL.tables);

  // 12 Reports
  H(12, 'Reports and exports');
  const rep = REPORTS.filter(([, perm]) => perms.has(perm));
  table(['Report', 'Where', 'Export allowed'], rep.map(([r, perm, where]) => [r, where, r.includes('CSV') ? (perms.has('report.export') || (r.startsWith('Audit') && perms.has('audit.export')) ? 'Yes' : 'View only — export needs report.export') : 'Yes (print)']));
  if (hasAny(perms, ['report.export', 'audit.export'])) figure('reports');
  p('Every export is recorded in the audit trail. CSV files are UTF-8 and protected against spreadsheet formula injection.');

  // 13 Notifications
  H(13, 'Notifications and alerts');
  ul(GENERAL.notifications);
  figure('notifications');

  // 14 Errors
  H(14, 'Error messages and troubleshooting');
  const errRows = [...GENERAL.troubleshooting];
  for (const m of mods) for (const e of m.errors ?? []) errRows.push(e);
  table(['Message or symptom', 'Cause', 'What to do'], errRows, 'small');

  // 15 Mistakes
  H(15, 'Common mistakes and how to prevent them');
  ul(GENERAL.mistakes);

  // 16 Security and access
  H(16, 'Security and access limitations');
  p('Permissions granted to your role (as enforced by the server):');
  table(['Permission', 'Meaning'], [...perms].sort().map((x) => [x, permDesc[x] ?? '']), 'small');
  const denied = Object.keys(permDesc).filter((x) => !perms.has(x));
  p(`Not granted (${denied.length} permissions): ${denied.join(', ')}.`);
  if (restrictedProcs.length) { h2('Procedures you cannot perform'); ul(restrictedProcs); }
  ul(['Your role may additionally be limited to specific sites; records of other sites are then hidden or read-only.', 'Never share your password: it is also your electronic-signature credential.', 'Sign out or lock your screen when leaving the workstation.']);

  // 17 Example
  H(17, 'Practical end-to-end example');
  p('Based on the fictional NovaCure demonstration data:');
  ol(role.example);

  // 18 FAQ
  H(18, 'Frequently asked questions');
  for (const [q, a] of GENERAL.faq) { md.push(`**${q}** ${a}\n`); html.push(`<p class="faq"><b>${esc(q)}</b><br/>${esc(a)}</p>`); }

  // 19 Glossary
  H(19, 'Glossary');
  table(['Term', 'Meaning'], GENERAL.glossary, 'small');

  // 20 Escalation
  H(20, 'Escalation');
  p('Escalate through the roles configured in your company. This release has no built-in external support desk and no vendor contact details; use your company’s documented support and incident procedures.');
  ul(role.escalation);
  ul(['Access problems (locked account, missing permission): Company Admin.', 'Any suspected data-integrity problem (for example “Integrity failure” on audit verification): QA Manager immediately.']);

  // TOC
  const tocHtml = `<section class="toc"><h1>Contents</h1><ol>${chapters.map((c) => `<li><a href="#${c.id}">${esc(c.t)}</a></li>`).join('')}</ol><p class="muted">List of figures: ${fig} screenshots captured from the running application.</p></section>`;
  html[tocAt] = tocHtml;
  md[md.indexOf('<!--TOC-->')] = `## Contents\n\n${chapters.map((c) => `${c.n}. ${c.t}`).join('\n')}\n`;
  return { md: md.join('\n'), html: html.join('\n'), figures: fig, chapters: chapters.length };
}

const CSS = `
@page { size: A4; margin: 20mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", "Inter", Arial, sans-serif; font-size: 10.2pt; line-height: 1.45; color: #1B2840; }
h1.chapter { font-size: 17pt; color: #0B1E3F; border-bottom: 2px solid #1F4FCC; padding-bottom: 4px; margin: 0 0 10px; page-break-before: always; }
h1.chapter .num { display: inline-block; min-width: 28px; color: #1F4FCC; }
h2 { font-size: 12.5pt; color: #0B1E3F; margin: 16px 0 6px; page-break-after: avoid; }
h3 { font-size: 11pt; margin: 12px 0 4px; page-break-after: avoid; }
p { margin: 4px 0 8px; }
ol.steps li, ul li { margin: 2px 0; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; table-layout: fixed; word-wrap: break-word; }
th { background: #EAF0FC; color: #0B1E3F; text-align: left; font-weight: 600; }
th, td { border: 1px solid #CBD5E6; padding: 4px 6px; vertical-align: top; }
table.small { font-size: 8.8pt; }
tr { page-break-inside: avoid; }
figure { margin: 10px 0 14px; page-break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 165mm; border: 1px solid #CBD5E6; border-radius: 3px; }
figcaption { font-size: 8.8pt; color: #52607A; margin-top: 4px; text-align: left; }
figcaption ol.legend { margin: 4px 0 0; padding-left: 18px; color: #1B2840; }
figcaption ol.legend li::marker { color: #1F4FCC; font-weight: 700; }
.callout { border-left: 4px solid #1F4FCC; background: #F1F5FD; padding: 6px 10px; margin: 8px 0; font-size: 9.4pt; page-break-inside: avoid; }
.callout.warn { border-color: #b7791f; background: #fdf6e7; }
.callout.muted { border-color: #8C97AB; background: #F4F6FA; }
.faq { page-break-inside: avoid; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
.cover { position: relative; }
.cover .band { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #0B1E3F 0%, #1F4FCC 60%, #13B5C7 100%); border-radius: 3px; }
.cover .brand svg { width: 330px; height: auto; }
.cover .brand { margin-bottom: 4mm; }
.cover .kicker { font-size: 9.5pt; color: #52607A; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 32mm; }
.cover .title { font-size: 30pt; font-weight: 700; line-height: 1.15; margin-bottom: 10mm; color: #0B1E3F; border-left: 6px solid #1F4FCC; padding-left: 12px; }
.cover .aud { font-size: 11pt; margin-bottom: 10mm; }
.cover table.meta td:first-child { width: 42mm; font-weight: 600; background: #EAF0FC; color: #0B1E3F; }
.cover .disclaimer { margin-top: 12mm; font-size: 8.8pt; color: #52607A; border-top: 1px solid #CBD5E6; padding-top: 6px; }
.toc { page-break-before: always; }
.toc h1 { font-size: 17pt; color: #0B1E3F; border-bottom: 2px solid #1F4FCC; padding-bottom: 4px; }
.toc ol { font-size: 11pt; line-height: 1.9; }
.toc a { color: #1A3FA6; text-decoration: none; }
.muted { color: #52607A; font-size: 9pt; }
`;

async function main() {
  const out = { md: resolve(root, 'MANUAL_SOURCES'), pdf: resolve(root, 'PDF') };
  rmSync(out.pdf, { recursive: true, force: true });
  mkdirSync(out.md, { recursive: true });
  mkdirSync(out.pdf, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' });
  const page = await browser.newPage();
  const results = [];
  for (const role of ROLE_MANUALS) {
    if (!manifest.roles[role.slug]) { results.push({ role, error: 'no screenshots captured' }); continue; }
    const m = buildManual(role);
    writeFileSync(resolve(out.md, `${role.slug}_manual.md`), m.md);
    const htmlPath = resolve(out.md, `${role.slug}_manual.html`);
    writeFileSync(htmlPath, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pharmodry — ${esc(role.title)} User Manual</title><style>${CSS}</style></head><body>${m.html}</body></html>`);
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.evaluate(async () => { await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))); });
    const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
    const pdfName = `${role.no}_${role.title.replace(/[\/ ]+/g, '_').replace(/_+/g, '_')}_User_Manual.pdf`;
    await page.pdf({
      path: resolve(out.pdf, pdfName),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '20mm', bottom: '18mm', left: '16mm', right: '16mm' },
      headerTemplate: `<div style="font-size:7.5pt;color:#52607A;width:100%;padding:0 16mm;display:flex;justify-content:space-between;align-items:center;"><span style="display:flex;align-items:center;gap:5px;"><img src="${MARK_DATA_URI}" style="width:11px;height:11px;"/><b style="color:#0B1E3F;">Pharmodry</b>&nbsp;${VERSION} · ${BRAND.line}</span><span>${esc(role.title)} User Manual · v${DOC_VERSION}</span></div>`,
      footerTemplate: `<div style="font-size:7.5pt;color:#52607A;width:100%;padding:0 16mm;display:flex;justify-content:space-between;"><span>Fictional demo data · Generated ${today}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    const buf = readFileSync(resolve(out.pdf, pdfName));
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    results.push({ role, pdf: `docs/USER_MANUALS/PDF/${pdfName}`, pages, bytes: statSync(resolve(out.pdf, pdfName)).size, figures: m.figures, chapters: m.chapters, broken });
    console.log(`${pdfName}: ${pages} pages, ${m.figures} figures, ${m.chapters} chapters${broken.length ? `, BROKEN IMAGES: ${broken.join(', ')}` : ''}`);
  }
  await browser.close();
  writeFileSync(resolve(root, 'PDF/manifest.json'), JSON.stringify({ generated: today, version: VERSION, manuals: results.map((r) => ({ role: r.role.title, code: r.role.code, pdf: r.pdf, pages: r.pages, bytes: r.bytes, figures: r.figures, chapters: r.chapters, brokenImages: r.broken, error: r.error })), deferred: DEFERRED_ROLES }, null, 2));
  writeCatalog();
  writeInventory();
}

function writeCatalog() {
  const L = ['# Role and Permission Catalog', '', `Generated ${today} from the application’s role definitions (\`packages/types/src/permissions.ts\`, the same source the server enforces) and from the sidebar recorded during screenshot capture (${manifest.generatedAt.slice(0, 10)}). Roles are configurable per company; this catalog describes the **default** roles shipped with Pharmodry ${VERSION}.`, ''];
  L.push('| # | Role | Code | Status | Manual |', '|---|---|---|---|---|');
  for (const r of ROLE_MANUALS) L.push(`| ${r.no} | ${r.title} | \`${r.code}\` | Implemented | \`PDF/${r.no}_${r.title.replace(/[\/ ]+/g, '_').replace(/_+/g, '_')}_User_Manual.pdf\` |`);
  for (const d of DEFERRED_ROLES) L.push(`| ${d.no} | ${d.title} | — | **Deferred** — ${d.note} | none |`);
  L.push('');
  for (const r of ROLE_MANUALS) {
    const perms = permsOf(r.code);
    const nav = manifest.roles[r.slug]?.nav ?? [];
    L.push(`## ${r.no}. ${r.title} (\`${r.code}\`)`, '', `**Purpose.** ${r.purpose}`, '');
    L.push(`**Authorized modules (sidebar as rendered).** ${nav.map((n) => n.label).join(', ') || '—'}`, '');
    const allowed = [];
    const restricted = [];
    for (const m of MODULES) for (const pr of m.procedures ?? []) if (pr.perm) (hasAny(perms, pr.perm) ? allowed : restricted).push(`${pr.title} (${m.title.split(':')[0]})`);
    L.push(`**Allowed actions.** ${allowed.join('; ') || 'View only.'}`, '');
    L.push(`**Restricted actions.** ${restricted.join('; ') || 'None.'}`, '');
    L.push(`**Dashboard widgets.** ${perms.has('analytics.view') ? 'Management dashboard KPIs and charts' : 'No dashboard'}${perms.has('commandcenter.view') ? '; Command Center' : ''}; My work queues matching the permissions below.`, '');
    L.push(`**Common workflows.** ${r.responsibilities.join(' ')}`, '');
    L.push(`**Relevant reports.** ${REPORTS.filter(([, p]) => perms.has(p)).map(([t]) => t).join('; ') || '—'}${perms.has('report.export') ? '' : ' (export of CSV reports requires report.export)'}`, '');
    L.push(`**Dependencies.** ${r.dependencies.join(' ')}`, '');
    L.push(`**Access limitations.** Server-enforced permissions: \`${[...perms].sort().join('`, `')}\`. Assignments may be site-scoped.`, '');
  }
  L.push('## Deferred roles', '', ...DEFERRED_ROLES.map((d) => `- **${d.title}** — ${d.note}`), '');
  writeFileSync(resolve(root, 'ROLE_AND_PERMISSION_CATALOG.md'), L.join('\n'));
}

function writeInventory() {
  const L = ['# Screenshot Inventory', '', `All screenshots are genuine captures of the running application, taken by \`apps/web/manuals/capture.spec.ts\` on ${manifest.generatedAt} against a freshly seeded, disposable database (fictional NovaCure data), viewport ${manifest.viewport}, Microsoft Edge via Playwright. No screenshot is edited or annotated; originals are stored as captured.`, '', `Total: ${manifest.shots.length} screenshots. Capture failures: ${manifest.failures.length}.`, ''];
  if (manifest.failures.length) { L.push('## Capture failures (not used in manuals)', '', '| Role | Screen | Error |', '|---|---|---|', ...manifest.failures.map((f) => `| ${f.role} | ${f.name} | ${f.error.replace(/\|/g, '/')} |`), ''); }
  const byRole = {};
  for (const s of manifest.shots) (byRole[s.role] ??= []).push(s);
  for (const [role, shots] of Object.entries(byRole)) {
    L.push(`## ${roleTitle[role] ?? role} (\`SCREENSHOTS/${role}/\`)`, '', '| File | Screen | Captured at URL | Type | Annotated copy |', '|---|---|---|---|---|');
    for (const s of shots) L.push(`| \`${s.file}\` | ${s.title} | \`${s.url}\` | ${s.phase === 'workflow' ? 'workflow step' : 'screen tour'} | ${s.annotated ? `\`${s.annotated}\`` : '—'} |`);
    L.push('');
  }
  writeFileSync(resolve(root, 'SCREENSHOT_INVENTORY.md'), L.join('\n'));
}


main().catch((e) => { console.error(e); process.exit(1); });
