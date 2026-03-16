#!/usr/bin/env node
import { Command } from 'commander';
import { runAudit } from './audit.js';
import type { Severity } from '../detectors/types.js';
import type { ReportFormat } from '../reporter/types.js';

const program = new Command();

program
  .name('sca')
  .description('Smart Contract Auditor — automated Solidity security analysis')
  .version('0.1.0');

program
  .command('audit <path>')
  .description('Audit a .sol file or directory of .sol files')
  .option('--format <fmt>', 'output format: json|markdown|both', 'both')
  .option('--output <dir>', 'write report to directory (default: stdout)')
  .option(
    '--severity <levels>',
    'minimum severity to include (critical|high|medium|low|informational)'
  )
  .action(async (targetPath: string, opts: { format: string; output?: string; severity?: string }) => {
    const format = (opts.format ?? 'both') as ReportFormat;
    const validFormats: ReportFormat[] = ['json', 'markdown', 'both'];
    if (!validFormats.includes(format)) {
      process.stderr.write(`Error: --format must be one of: ${validFormats.join(', ')}\n`);
      process.exit(2);
    }

    const minSeverity = opts.severity as Severity | undefined;
    const validSeverities: Severity[] = ['critical', 'high', 'medium', 'low', 'informational'];
    if (minSeverity && !validSeverities.includes(minSeverity)) {
      process.stderr.write(`Error: --severity must be one of: ${validSeverities.join(', ')}\n`);
      process.exit(2);
    }

    try {
      const exitCode = await runAudit(targetPath, {
        format,
        outputDir: opts.output,
        minSeverity,
      });
      process.exit(exitCode);
    } catch (err) {
      process.stderr.write(`Error: ${String(err)}\n`);
      process.exit(2);
    }
  });

program.parse();
