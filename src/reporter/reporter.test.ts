import { describe, it, expect } from 'vitest';
import { buildReport, toJSON, toMarkdown } from './generator.js';
import type { Finding } from '../detectors/types.js';

const mockFindings: Finding[] = [
  {
    severity: 'critical',
    title: 'Reentrancy in withdraw()',
    description: 'External call before state update.',
    location: { file: 'Vault.sol', line: 42, contract: 'Vault', function: 'withdraw' },
    recommendation: 'Apply CEI pattern.',
    detector: 'reentrancy',
  },
  {
    severity: 'high',
    title: 'Missing Access Control on mint()',
    description: 'Public function without modifier.',
    location: { file: 'Token.sol', line: 18, contract: 'Token', function: 'mint' },
    recommendation: 'Add onlyOwner modifier.',
    detector: 'access-control',
  },
  {
    severity: 'medium',
    title: 'Unchecked Return Value of .call()',
    description: 'Return value not checked.',
    location: { file: 'Vault.sol', line: 55, contract: 'Vault', function: 'sendEther' },
    recommendation: 'Check return value.',
    detector: 'unchecked-calls',
  },
  {
    severity: 'low',
    title: 'Use of tx.origin',
    description: 'tx.origin used for auth.',
    location: { file: 'Auth.sol', line: 10, contract: 'Auth', function: 'isOwner' },
    recommendation: 'Use msg.sender.',
    detector: 'tx-origin',
  },
];

const scope = {
  files: ['Vault.sol', 'Token.sol', 'Auth.sol'],
  compilerVersion: '0.8.19',
};

// ─── buildReport ────────────────────────────────────────────────────────────

describe('buildReport', () => {
  it('returns correct total count', () => {
    const report = buildReport(mockFindings, scope);
    expect(report.summary.total).toBe(4);
  });

  it('counts findings by severity', () => {
    const report = buildReport(mockFindings, scope);
    expect(report.summary.bySeverity.critical).toBe(1);
    expect(report.summary.bySeverity.high).toBe(1);
    expect(report.summary.bySeverity.medium).toBe(1);
    expect(report.summary.bySeverity.low).toBe(1);
    expect(report.summary.bySeverity.informational).toBe(0);
  });

  it('aggregates risk as highest severity present', () => {
    const report = buildReport(mockFindings, scope);
    expect(report.summary.riskRating).toBe('critical');
  });

  it('riskRating is "high" when no critical findings', () => {
    const highOnly = mockFindings.filter((f) => f.severity !== 'critical');
    const report = buildReport(highOnly, scope);
    expect(report.summary.riskRating).toBe('high');
  });

  it('riskRating is "informational" when no findings', () => {
    const report = buildReport([], scope);
    expect(report.summary.riskRating).toBe('informational');
  });

  it('sorts findings by severity (critical first)', () => {
    // Reverse order input
    const reversed = [...mockFindings].reverse();
    const report = buildReport(reversed, scope);
    expect(report.findings[0].severity).toBe('critical');
    expect(report.findings[1].severity).toBe('high');
    expect(report.findings[2].severity).toBe('medium');
    expect(report.findings[3].severity).toBe('low');
  });

  it('includes timestamp and scope', () => {
    const report = buildReport(mockFindings, scope);
    expect(report.timestamp).toBeTruthy();
    expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
    expect(report.scope.files).toEqual(scope.files);
    expect(report.scope.compilerVersion).toBe('0.8.19');
  });
});

// ─── toJSON ─────────────────────────────────────────────────────────────────

describe('toJSON', () => {
  it('produces valid JSON with all findings', () => {
    const report = buildReport(mockFindings, scope);
    const json = toJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.findings).toHaveLength(4);
    expect(parsed.summary.riskRating).toBe('critical');
  });

  it('includes timestamp in JSON output', () => {
    const report = buildReport(mockFindings, scope);
    const parsed = JSON.parse(toJSON(report));
    expect(parsed.timestamp).toBeTruthy();
  });
});

// ─── toMarkdown ─────────────────────────────────────────────────────────────

describe('toMarkdown', () => {
  it('includes audit report header', () => {
    const report = buildReport(mockFindings, scope);
    const md = toMarkdown(report);
    expect(md).toContain('# Smart Contract Security Audit Report');
  });

  it('includes executive summary with risk rating', () => {
    const report = buildReport(mockFindings, scope);
    const md = toMarkdown(report);
    expect(md).toContain('Executive Summary');
    expect(md).toContain('CRITICAL');
  });

  it('includes scope section with all files', () => {
    const report = buildReport(mockFindings, scope);
    const md = toMarkdown(report);
    expect(md).toContain('## Scope');
    expect(md).toContain('Vault.sol');
    expect(md).toContain('Token.sol');
  });

  it('includes findings table', () => {
    const report = buildReport(mockFindings, scope);
    const md = toMarkdown(report);
    expect(md).toContain('## Findings Summary');
    expect(md).toContain('Reentrancy in withdraw()');
    expect(md).toContain('Missing Access Control');
  });

  it('includes detailed findings with recommendations', () => {
    const report = buildReport(mockFindings, scope);
    const md = toMarkdown(report);
    expect(md).toContain('## Detailed Findings');
    expect(md).toContain('Apply CEI pattern.');
    expect(md).toContain('Add onlyOwner modifier.');
  });

  it('handles empty findings gracefully', () => {
    const report = buildReport([], scope);
    const md = toMarkdown(report);
    expect(md).toContain('No vulnerabilities detected');
  });

  it('shows compiler version when provided', () => {
    const report = buildReport(mockFindings, scope);
    const md = toMarkdown(report);
    expect(md).toContain('0.8.19');
  });
});
