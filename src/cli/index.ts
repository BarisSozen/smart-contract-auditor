#!/usr/bin/env node
// CLI entry point for the smart-contract-auditor.
// Full implementation lives in HAS-7.
import { Command } from 'commander';

const program = new Command();

program
  .name('sca')
  .description('Smart Contract Auditor — automated Solidity security analysis')
  .version('0.1.0');

program
  .command('audit <path>')
  .description('Audit a Solidity file or directory')
  .option('--format <fmt>', 'output format: json|markdown|both', 'both')
  .option('--output <dir>', 'write report to directory (default: stdout)')
  .option('--severity <levels>', 'filter by minimum severity (e.g. critical,high)')
  .action((_path: string, _options: unknown) => {
    console.error('Audit command not yet implemented — see HAS-7');
    process.exit(1);
  });

program.parse();
