export const SNAPSHOT_SCHEMA: number;
export interface LlmModelRecord { id: string; display_name: string | null; created_at: string | null; max_input_tokens: number | null; max_tokens: number | null }
export interface SourceError { error?: string; skipped?: boolean }
export interface Snapshot {
  schema: number;
  seeded: boolean;
  capturedAt?: string | null;
  higgsfield: {
    docsIndex: ({ links: string[] } & SourceError) | SourceError;
    openapi: ({ version: string | null; paths: string[] } & SourceError) | SourceError;
    terms: ({ sha256: string; chars: number } & SourceError) | SourceError;
  };
  llms: ({ models: LlmModelRecord[] } & SourceError) | SourceError;
}
export interface SetDiff { added: string[]; removed: string[] }
export interface ModelDiff { added: LlmModelRecord[]; removed: LlmModelRecord[]; changed: { id: string; fields: { field: string; from: unknown; to: unknown }[] }[] }
export interface SnapshotDiff {
  baseline: boolean;
  unavailable: { source: string; reason: string }[];
  docsIndex: SetDiff | null;
  openapi: (SetDiff & { from: string | null; to: string | null; versionChanged: boolean }) | null;
  terms: { from: string; to: string } | null;
  llms: ModelDiff | null;
  llmsBaselineMissing: boolean;
}
export function extractMarkdownLinks(text: string): string[];
export function extractOpenApi(doc: unknown): { version: string | null; paths: string[] };
export function htmlToText(html: string): string;
export function normalizeWhitespace(s: string): string;
export function sha256Hex(s: string): string;
export function fingerprintText(text: string): { sha256: string; chars: number };
export function diffSets(prev?: readonly string[], next?: readonly string[]): SetDiff;
export function diffModels(prev?: readonly LlmModelRecord[], next?: readonly LlmModelRecord[]): ModelDiff;
export function diffSnapshots(prev: Snapshot | null | undefined, next: Snapshot): SnapshotDiff;
export function hasChanges(d: SnapshotDiff): boolean;
export function mergeForWrite(prev: Snapshot | null | undefined, next: Snapshot): Snapshot;
export const NEXT_STEPS: string[];
export function renderReport(diff: SnapshotDiff, meta?: { date?: string; llmsSkipped?: boolean; links?: number; paths?: number; models?: number }): string;
