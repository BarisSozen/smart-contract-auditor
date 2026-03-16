import type { Finding } from '../detectors/types.js';

export interface AuditScope {
  files: string[];
  compilerVersion?: string;
  framework?: string;
}

export interface AuditReport {
  timestamp: string;
  scope: AuditScope;
  findings: Finding[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    riskRating: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  };
}

export type ReportFormat = 'json' | 'markdown' | 'both';
