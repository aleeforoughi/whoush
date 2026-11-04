// Pure helpers for scripts/capability-scout.mjs: no network, no filesystem. Unit-tested in tests/capability-scout.test.ts.
import { createHash } from "node:crypto";

export const SNAPSHOT_SCHEMA = 1;

/** Sorted, de-duplicated absolute markdown link targets: `[text](https://...)`. A trailing `#fragment` is kept; a `<...>` wrapper is removed. */
export function extractMarkdownLinks(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\]\(\s*<?(https?:\/\/[^)\s>]+)>?[^)]*\)/g)) out.add(m[1]);
  return [...out].sort();
}

/** `{ version, paths }` from an OpenAPI document (object or JSON text). Paths are sorted; a malformed document yields an empty result with `version: null`. */
export function extractOpenApi(doc) {
  let d = doc;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } }
  const version = d && typeof d === "object" && d.info && typeof d.info.version === "string" ? d.info.version : null;
  const paths = d && typeof d === "object" && d.paths && typeof d.paths === "object" ? Object.keys(d.paths).sort() : [];
  return { version, paths };
}

export const normalizeWhitespace = (s) => String(s).replace(/\s+/g, " ").trim();
export const sha256Hex = (s) => createHash("sha256").update(s).digest("hex");
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", ndash: "\u2013", mdash: "\u2014" };
/** Visible text of an HTML page: script, style and comment blocks and all tags are dropped, so server-rendered state (timestamps, asset hashes) never counts as a change. */
export function htmlToText(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " "; }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}
/** Whitespace-normalized text fingerprint, so a reflow does not count as a change. */
export function fingerprintText(text) {
  const n = normalizeWhitespace(text);
  return { sha256: sha256Hex(n), chars: n.length };
}

/** `{ added, removed }` between two string lists (sorted, unique). */
export function diffSets(prev = [], next = []) {
  const a = new Set(prev), b = new Set(next);
  return { added: [...b].filter((x) => !a.has(x)).sort(), removed: [...a].filter((x) => !b.has(x)).sort() };
}

const MODEL_FIELDS = ["display_name", "max_input_tokens", "max_tokens"];
/** Model-list diff by id. `created_at` is recorded but never reported as a change. */
export function diffModels(prev = [], next = []) {
  const p = new Map(prev.map((m) => [m.id, m])), n = new Map(next.map((m) => [m.id, m]));
  const added = [...n.keys()].filter((id) => !p.has(id)).sort().map((id) => n.get(id));
  const removed = [...p.keys()].filter((id) => !n.has(id)).sort().map((id) => p.get(id));
  const changed = [];
  for (const [id, m] of [...n].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const old = p.get(id);
    if (!old) continue;
    const fields = MODEL_FIELDS.filter((f) => (old[f] ?? null) !== (m[f] ?? null)).map((f) => ({ field: f, from: old[f] ?? null, to: m[f] ?? null }));
    if (fields.length) changed.push({ id, fields });
  }
  return { added, removed, changed };
}

const usable = (s) => Boolean(s) && !s.error && !s.skipped;

/**
 * Compare two snapshots. A source that failed or was skipped in `next` is reported as unavailable and never as "everything removed".
 * With no seeded baseline (`prev` missing or `seeded: false`) nothing is compared and `baseline` is false.
 */
export function diffSnapshots(prev, next) {
  const baseline = Boolean(prev && prev.seeded);
  const res = { baseline, unavailable: [], docsIndex: null, openapi: null, terms: null, llms: null, llmsBaselineMissing: false };
  const note = (name, s) => { if (s && (s.error || s.skipped)) res.unavailable.push({ source: name, reason: s.error ? String(s.error) : "skipped" }); };
  const nh = next.higgsfield ?? {}, ph = (prev && prev.higgsfield) ?? {};
  note("llms.txt", nh.docsIndex); note("openapi.json", nh.openapi); note("terms", nh.terms); note("llm models", next.llms);
  if (!baseline) return res;
  if (usable(nh.docsIndex) && usable(ph.docsIndex)) { const d = diffSets(ph.docsIndex.links, nh.docsIndex.links); if (d.added.length || d.removed.length) res.docsIndex = d; }
  if (usable(nh.openapi) && usable(ph.openapi)) {
    const d = diffSets(ph.openapi.paths, nh.openapi.paths), versionChanged = (ph.openapi.version ?? null) !== (nh.openapi.version ?? null);
    if (d.added.length || d.removed.length || versionChanged) res.openapi = { ...d, from: ph.openapi.version ?? null, to: nh.openapi.version ?? null, versionChanged };
  }
  if (usable(nh.terms) && usable(ph.terms) && ph.terms.sha256 !== nh.terms.sha256) res.terms = { from: ph.terms.sha256, to: nh.terms.sha256 };
  if (usable(next.llms)) {
    if (!usable(prev.llms)) res.llmsBaselineMissing = true;
    else { const d = diffModels(prev.llms.models, next.llms.models); if (d.added.length || d.removed.length || d.changed.length) res.llms = d; }
  }
  return res;
}

export const hasChanges = (d) => Boolean(d.docsIndex || d.openapi || d.terms || d.llms || d.llmsBaselineMissing);

/** Keep the previous value of any source that is unavailable now, so a transient failure never erases the baseline. */
export function mergeForWrite(prev, next) {
  const out = structuredClone(next);
  if (prev) {
    for (const k of ["docsIndex", "openapi", "terms"]) if (!usable(out.higgsfield?.[k]) && usable(prev.higgsfield?.[k])) out.higgsfield[k] = prev.higgsfield[k];
    if (!usable(out.llms) && usable(prev.llms)) out.llms = prev.llms;
  }
  const hf = out.higgsfield ?? {};
  out.seeded = ["docsIndex", "openapi", "terms"].every((k) => usable(hf[k]));
  return out;
}

const code = (s) => "`" + s + "`";
const list = (items, f = code) => items.map((x) => "  - " + f(x));
const fmtModel = (m) => `${code(m.id)} (${m.display_name ?? "?"}; input ${m.max_input_tokens ?? "?"}, output ${m.max_tokens ?? "?"}; created ${m.created_at ?? "?"})`;

export const NEXT_STEPS = [
  "Verify the model's API path and input schema in its own documentation (https://console.higgsfield.ai and the model's `llms.txt`), and record the evidence in `docs/HIGGSFIELD_EVIDENCE.md`.",
  "Approve a fixed integer Neuron SKU (`docs/NEURON_PRICING.md`); never copy provider USD prices into code.",
  "Media inspection and moderation in place (`docs/MODERATION_POLICY.md` step 4).",
  "Provider authorization confirmed (`docs/LAUNCH_GATES.md` gate 1), and LLM tier changes reviewed by the owner for cost and margin.",
  "Update `data/capability-snapshot.json` by PR after review. Nothing is enabled automatically."
];

/** Markdown report. `meta` = `{ date, llmsSkipped, links, paths, models }` (counts for context). */
export function renderReport(diff, meta = {}) {
  const L = [`# Capability scout (CI): Higgsfield docs + LLM models`, "", `Run date: ${meta.date ?? "unknown"}. Read-only: nothing here changes code, the catalogue or the snapshot.`, ""];
  if (!diff.baseline) L.push("> No seeded baseline in `data/capability-snapshot.json`: nothing was compared. Run `node scripts/capability-scout.mjs --write` and commit the result after review.", "");
  if (diff.unavailable.length) { L.push("## Sources unavailable this run", ...diff.unavailable.map((u) => `- ${u.source}: ${u.reason}`), "(not compared; the baseline for these is unchanged)", ""); }
  const sections = [];
  if (diff.docsIndex) sections.push(["Higgsfield docs index (`llms.txt`)", [...(diff.docsIndex.added.length ? ["- New links:", ...list(diff.docsIndex.added)] : []), ...(diff.docsIndex.removed.length ? ["- Removed links:", ...list(diff.docsIndex.removed)] : [])]]);
  if (diff.openapi) { const o = diff.openapi; sections.push(["Higgsfield `openapi.json`", [...(o.versionChanged ? [`- info.version: ${code(o.from ?? "none")} to ${code(o.to ?? "none")}`] : []), ...(o.added.length ? ["- New paths:", ...list(o.added)] : []), ...(o.removed.length ? ["- Removed paths:", ...list(o.removed)] : [])]]); }
  if (diff.terms) sections.push(["Higgsfield terms of service", [`- Normalized text changed (sha256 ${code(diff.terms.from.slice(0, 12))} to ${code(diff.terms.to.slice(0, 12))}). Re-read https://open.higgsfield.ai/terms-of-service against \`docs/LAUNCH_GATES.md\` gate 1.`]]);
  if (diff.llms) sections.push(["LLM models", [...(diff.llms.added.length ? ["- New:", ...list(diff.llms.added, fmtModel)] : []), ...(diff.llms.removed.length ? ["- Removed:", ...list(diff.llms.removed, fmtModel)] : []), ...(diff.llms.changed.length ? ["- Changed:", ...diff.llms.changed.map((c) => `  - ${code(c.id)}: ` + c.fields.map((f) => `${f.field} ${code(String(f.from))} to ${code(String(f.to))}`).join("; "))] : []), "- Tier changes are recommendations for the owner (cost and margin), never applied automatically."]]);
  if (diff.llmsBaselineMissing) sections.push(["LLM models", [`- The snapshot has no model list yet; this run listed ${meta.models ?? "?"} models. Add them to the snapshot after review.`]]);
  if (!sections.length) L.push(diff.baseline ? "## No changes" : "## Counts", `Docs links: ${meta.links ?? "?"}; openapi paths: ${meta.paths ?? "?"}; LLM models: ${meta.llmsSkipped ? "skipped (no ANTHROPIC_API_KEY)" : (meta.models ?? "?")}.`, "");
  for (const [title, lines] of sections) L.push(`## ${title}`, ...lines, "");
  if (hasChanges(diff)) L.push("## Next steps", ...NEXT_STEPS.map((s) => "- [ ] " + s), "");
  return L.join("\n");
}
