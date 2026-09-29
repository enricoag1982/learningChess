// Reading authored YAML: the one path from a file to parsed data or labelled issue lines.
import { readdirSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';

/** What a loader gets back: the value, or every issue found reading it. */
export type Loaded<T> = { readonly data: T } | { readonly issues: string[] };

/** First line of an error's message, for compact single-line issue reporting. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

/** One issue, formatted `<file>: <path>: <message>`. A mini-game's `mode` makes its schema a union:
 * `invalid_union` is flattened into every branch's own issues; an unknown discriminator has none. */
function formatZodIssue(label: string, issue: z.core.$ZodIssue): string[] {
  if (issue.code === 'invalid_union') {
    const branchLines = issue.errors.flatMap((branchIssues) =>
      branchIssues.flatMap((branchIssue) => formatZodIssue(label, branchIssue)),
    );
    if (branchLines.length > 0) return branchLines;
  }
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return [`${label}: ${path}: ${issue.message}`];
}

/** Reads and parses one YAML file (duplicate keys rejected); a read or syntax failure is an issue. */
export function readYaml(filePath: string, label: string): Loaded<unknown> {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    return { issues: [`${label}: cannot read file: ${errorMessage(error)}`] };
  }
  try {
    return { data: parseYaml(raw, { uniqueKeys: true }) };
  } catch (error) {
    return { issues: [`${label}: YAML syntax error: ${errorMessage(error)}`] };
  }
}

/** {@link readYaml}, then validates the result against `schema`. */
export function loadYaml<S extends z.ZodType>(
  filePath: string,
  label: string,
  schema: S,
): Loaded<z.output<S>> {
  const read = readYaml(filePath, label);
  if ('issues' in read) return read;
  const result = schema.safeParse(read.data);
  return result.success
    ? { data: result.data }
    : { issues: result.error.issues.flatMap((issue) => formatZodIssue(label, issue)) };
}

/** Reads a directory's entry names, reporting an issue (and returning `[]`) if it cannot be read. */
export function readEntries(dir: string, issues: string[], description: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch (error) {
    issues.push(`${dir}: cannot read ${description}: ${errorMessage(error)}`);
    return [];
  }
}
