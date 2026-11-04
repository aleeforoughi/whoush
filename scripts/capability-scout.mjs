#!/usr/bin/env node
// Capability scout (CI half). Read-only: fetches public Higgsfield docs and (with ANTHROPIC_API_KEY) the Anthropic model list, diffs them against
// data/capability-snapshot.json and prints a markdown report. It never edits code or the catalogue, and always exits 0 (a diff is not a failure).
// Usage: node scripts/capability-scout.mjs [--write] [--out report.md] [--snapshot path]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { SNAPSHOT_SCHEMA, diffSnapshots, extractMarkdownLinks, extractOpenApi, fingerprintText, hasChanges, htmlToText, mergeForWrite, renderReport } from "./capability-scout-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const snapshotPath = path.resolve(value("--snapshot") ?? path.join(root, "data", "capability-snapshot.json"));
const UA = "whoush-capability-scout";
const URLS = { llms: "https://docs.higgsfield.ai/docs/llms.txt", openapi: "https://docs.higgsfield.ai/docs/openapi.json", terms: "https://open.higgsfield.ai/terms-of-service" };

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}
const guarded = async (f) => { try { return await f(); } catch (e) { return { error: e instanceof Error ? (e.name === "TimeoutError" ? "timeout after 10 s" : e.message) : String(e) }; } };

async function listModels() {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: true };
  return guarded(async () => {
    const models = [];
    for await (const m of new Anthropic().models.list({ limit: 100 })) {
      models.push({ id: m.id, display_name: m.display_name ?? null, created_at: m.created_at ?? null, max_input_tokens: m.max_input_tokens ?? null, max_tokens: m.max_tokens ?? null });
    }
    return { models: models.sort((a, b) => (a.id < b.id ? -1 : 1)) };
  });
}

const [docsIndex, openapi, terms, llms] = await Promise.all([
  guarded(async () => ({ links: extractMarkdownLinks(await fetchText(URLS.llms)) })),
  guarded(async () => extractOpenApi(await fetchText(URLS.openapi))),
  guarded(async () => fingerprintText(htmlToText(await fetchText(URLS.terms)))),
  listModels()
]);
// A document that parsed to nothing is a failed fetch, not "everything was removed".
if (openapi.paths && !openapi.paths.length) Object.assign(openapi, { error: "no paths found", paths: undefined, version: undefined });
if (docsIndex.links && !docsIndex.links.length) Object.assign(docsIndex, { error: "no links found", links: undefined });
const next = { schema: SNAPSHOT_SCHEMA, seeded: true, capturedAt: new Date().toISOString(), higgsfield: { docsIndex, openapi, terms }, llms };

let prev = null;
try { prev = JSON.parse(fs.readFileSync(snapshotPath, "utf8")); } catch { /* no snapshot yet */ }

const diff = diffSnapshots(prev, next);
const report = renderReport(diff, { date: next.capturedAt.slice(0, 10), llmsSkipped: Boolean(llms.skipped), links: docsIndex.links?.length, paths: openapi.paths?.length, models: llms.models?.length });
process.stdout.write(report + "\n");
const out = value("--out");
if (out) fs.writeFileSync(out, report + "\n");
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${hasChanges(diff) ? "true" : "false"}\n`);
if (flag("--write")) {
  const merged = mergeForWrite(prev, next);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify(merged, null, 2) + "\n");
  process.stdout.write(`\nSnapshot written to ${path.relative(root, snapshotPath)} (seeded: ${merged.seeded}).\n`);
}
process.exit(0);
