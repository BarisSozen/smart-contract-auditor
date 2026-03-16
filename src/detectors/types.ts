import type { SourceUnit } from '../parser/types.js';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export interface FindingLocation {
  file: string;
  line: number;
  contract?: string;
  function?: string;
}

export interface Finding {
  severity: Severity;
  title: string;
  description: string;
  location: FindingLocation;
  recommendation: string;
  detector: string;
}

/** Plugin interface: every detector implements this. */
export interface Detector {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  detect(ast: SourceUnit, filePath: string): Finding[];
}
