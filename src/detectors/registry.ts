import { txOriginDetector } from './impl/tx-origin.js';
import { uncheckedCallsDetector } from './impl/unchecked-calls.js';
import { integerOverflowDetector } from './impl/integer-overflow.js';
import { accessControlDetector } from './impl/access-control.js';
import { reentrancyDetector } from './impl/reentrancy.js';
import type { Detector } from './types.js';
import type { SourceUnit } from '../parser/types.js';
import type { Finding } from './types.js';

export const ALL_DETECTORS: Detector[] = [
  reentrancyDetector,
  uncheckedCallsDetector,
  accessControlDetector,
  integerOverflowDetector,
  txOriginDetector,
];

/**
 * Run all (or a subset of) detectors against an AST and return combined findings.
 */
export function runDetectors(
  ast: SourceUnit,
  filePath: string,
  detectors: Detector[] = ALL_DETECTORS
): Finding[] {
  return detectors.flatMap((d) => d.detect(ast, filePath));
}
