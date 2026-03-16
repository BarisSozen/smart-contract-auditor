/**
 * Core audit pipeline: parse → detect → report.
 * Used by the CLI command and testable independently.
 */
import { readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { parseFile } from '../parser/parser.js';
import { runDetectors } from '../detectors/registry.js';
import { buildReport, toJSON, toMarkdown } from '../reporter/generator.js';
import type { Finding, Severity } from '../detectors/types.js';
import type { ReportFormat } from '../reporter/types.js';

export interface AuditOptions {
  format: ReportFormat;
  outputDir?: string;
  minSeverity?: Severity;
  silent?: boolean; // suppress progress output (for tests)
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

/**
 * Run the full audit pipeline on a file or directory.
 * Returns exit code: 0 = clean (no critical/high after filter), 1 = findings present.
 */
export async function runAudit(targetPath: string, options: AuditOptions): Promise<number> {
  const { format, outputDir, minSeverity, silent } = options;

  // Collect .sol files
  const files = await collectSolFiles(targetPath);
  if (files.length === 0) {
    log('⚠️  No .sol files found.', silent);
    return 0;
  }

  log(`🔍 Auditing ${files.length} file(s)...`, silent);

  const allFindings: Finding[] = [];
  const parsedFiles: string[] = [];

  for (const file of files) {
    log(`  → ${file}`, silent);
    const parseResult = await parseFile(file);
    if (!parseResult.ok) {
      log(`  ⚠️  Parse error in ${file}: ${parseResult.error.message}`, silent);
      continue;
    }
    parsedFiles.push(file);
    const findings = runDetectors(parseResult.value, file);
    allFindings.push(...findings);
  }

  // Apply severity filter
  const filtered = minSeverity
    ? allFindings.filter((f) => SEVERITY_RANK[f.severity] <= SEVERITY_RANK[minSeverity])
    : allFindings;

  log(
    `✅ Done. ${filtered.length} finding(s)${minSeverity ? ` at ${minSeverity}+` : ''}.`,
    silent
  );

  const report = buildReport(filtered, {
    files: parsedFiles,
    compilerVersion: undefined,
  });

  // Output
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
    const base = `audit-report-${Date.now()}`;

    if (format === 'json' || format === 'both') {
      const path = join(outputDir, `${base}.json`);
      await writeFile(path, toJSON(report), 'utf8');
      log(`📄 JSON report: ${path}`, silent);
    }
    if (format === 'markdown' || format === 'both') {
      const path = join(outputDir, `${base}.md`);
      await writeFile(path, toMarkdown(report), 'utf8');
      log(`📝 Markdown report: ${path}`, silent);
    }
  } else {
    // stdout
    if (format === 'json') {
      process.stdout.write(toJSON(report) + '\n');
    } else if (format === 'markdown') {
      process.stdout.write(toMarkdown(report) + '\n');
    } else {
      // both: print markdown to stdout, JSON to stderr
      process.stdout.write(toMarkdown(report) + '\n');
      process.stderr.write(toJSON(report) + '\n');
    }
  }

  // Exit code: 1 if any critical or high findings remain after filter
  const hasHighPlus = filtered.some(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );
  return hasHighPlus ? 1 : 0;
}

async function collectSolFiles(target: string): Promise<string[]> {
  const s = await stat(target).catch(() => null);
  if (!s) throw new Error(`Path not found: ${target}`);

  if (s.isFile()) {
    return extname(target) === '.sol' ? [target] : [];
  }

  // Directory: recurse
  const results: string[] = [];
  await walk(target, results);
  return results;
}

async function walk(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, out);
    } else if (e.isFile() && extname(e.name) === '.sol') {
      out.push(full);
    }
  }
}

function log(msg: string, silent?: boolean): void {
  if (!silent) process.stderr.write(msg + '\n');
}
