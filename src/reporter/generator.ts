import type { Finding, Severity } from '../detectors/types.js';
import type { AuditReport, AuditScope } from './types.js';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'informational'];
const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  informational: '⚪',
};

/**
 * Build an AuditReport from findings + scope metadata.
 */
export function buildReport(findings: Finding[], scope: AuditScope): AuditReport {
  const bySeverity: Record<string, number> = {};
  for (const sev of SEVERITY_ORDER) bySeverity[sev] = 0;
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;

  const riskRating = aggregateRisk(findings);

  return {
    timestamp: new Date().toISOString(),
    scope,
    findings: [...findings].sort(bySeverityOrder),
    summary: { total: findings.length, bySeverity, riskRating },
  };
}

/**
 * Serialize the report to a formatted JSON string.
 */
export function toJSON(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Render the report as a professional Markdown audit document.
 */
export function toMarkdown(report: AuditReport): string {
  const { summary, scope, findings, timestamp } = report;
  const lines: string[] = [];

  // Header
  lines.push('# Smart Contract Security Audit Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date(timestamp).toUTCString()}`);
  lines.push(`**Auditor:** Smart Contract Auditor v0.1.0`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(
    `This report presents the findings from an automated security audit of ` +
      `${scope.files.length} Solidity source file(s).`
  );
  lines.push('');
  lines.push(`**Overall Risk Rating:** ${riskBadge(summary.riskRating)}`);
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of SEVERITY_ORDER) {
    const count = summary.bySeverity[sev] ?? 0;
    if (count > 0) {
      lines.push(`| ${SEVERITY_EMOJI[sev]} ${capitalize(sev)} | ${count} |`);
    }
  }
  lines.push(`| **Total** | **${summary.total}** |`);
  lines.push('');

  // Scope
  lines.push('## Scope');
  lines.push('');
  lines.push('**Files Audited:**');
  for (const f of scope.files) lines.push(`- \`${f}\``);
  if (scope.compilerVersion) lines.push(`\n**Compiler Version:** ${scope.compilerVersion}`);
  if (scope.framework) lines.push(`**Framework:** ${scope.framework}`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('✅ No vulnerabilities detected.');
    lines.push('');
    return lines.join('\n');
  }

  // Findings Table
  lines.push('## Findings Summary');
  lines.push('');
  lines.push('| # | Severity | Title | Location |');
  lines.push('|---|----------|-------|----------|');
  findings.forEach((f, i) => {
    const loc = formatLocation(f);
    lines.push(
      `| ${i + 1} | ${SEVERITY_EMOJI[f.severity]} ${capitalize(f.severity)} | ${f.title} | ${loc} |`
    );
  });
  lines.push('');

  // Detailed Findings
  lines.push('## Detailed Findings');
  lines.push('');
  findings.forEach((f, i) => {
    lines.push(`### ${i + 1}. ${f.title}`);
    lines.push('');
    lines.push(`**Severity:** ${SEVERITY_EMOJI[f.severity]} ${capitalize(f.severity)}`);
    lines.push(`**Location:** ${formatLocation(f)}`);
    lines.push(`**Detector:** \`${f.detector}\``);
    lines.push('');
    lines.push('**Description:**');
    lines.push('');
    lines.push(f.description);
    lines.push('');
    lines.push('**Recommendation:**');
    lines.push('');
    lines.push(f.recommendation);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Overall risk = highest severity present.
 */
function aggregateRisk(findings: Finding[]): Severity {
  for (const sev of SEVERITY_ORDER) {
    if (findings.some((f) => f.severity === sev)) return sev;
  }
  return 'informational';
}

function bySeverityOrder(a: Finding, b: Finding): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
}

function formatLocation(f: Finding): string {
  const parts: string[] = [];
  if (f.location.contract) parts.push(f.location.contract);
  if (f.location.function) parts.push(`${f.location.function}()`);
  const label = parts.length > 0 ? `${parts.join('.')} ` : '';
  return `\`${f.location.file}:${f.location.line}\` ${label}`.trim();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function riskBadge(severity: Severity): string {
  const badges: Record<Severity, string> = {
    critical: '🔴 **CRITICAL**',
    high: '🟠 **HIGH**',
    medium: '🟡 **MEDIUM**',
    low: '🔵 **LOW**',
    informational: '⚪ **INFORMATIONAL**',
  };
  return badges[severity];
}
