import type { SolidityAST } from '../parser/types.js';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export interface Location {
  file: string;
  line: number;
  contract?: string;
  function?: string;
}

export interface Finding {
  severity: Severity;
  title: string;
  description: string;
  location: Location;
  recommendation: string;
  detector: string;
}

// Plugin interface: each detector implements this.
export interface Detector {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  detect(ast: SolidityAST, filePath: string): Finding[];
}
