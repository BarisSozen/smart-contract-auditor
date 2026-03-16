import { getContracts, getFunctions } from '../../parser/parser.js';
import type {
  SourceUnit,
  FunctionDefinition,
  Statement,
  Block,
  ExpressionStatement,
  FunctionCall,
  MemberAccess,
  BaseASTNode,
} from '../../parser/types.js';
import type { Detector, Finding, FindingLocation } from '../types.js';

/**
 * Detects classic reentrancy: an external call appearing BEFORE a state
 * (storage) write within the same function body.
 *
 * Pattern: checks-effects-interactions violation where the "interaction"
 * (external call) precedes the "effects" (state change).
 *
 * Limitations:
 * - Only detects within a single function (cross-function reentrancy requires
 *   a full call graph, which is out of scope for v1).
 * - Approximates "state write" as: assignment to a mapping or state variable.
 *
 * "Precise over comprehensive" — we require both an external call AND a
 * subsequent state write to fire.
 */
export const reentrancyDetector: Detector = {
  id: 'reentrancy',
  title: 'Reentrancy Vulnerability',
  severity: 'critical',

  detect(ast: SourceUnit, filePath: string): Finding[] {
    const findings: Finding[] = [];

    for (const contract of getContracts(ast)) {
      for (const fn of getFunctions(contract)) {
        if (!fn.body) continue;

        const stmts = flattenStatements(fn.body);
        const externalCallIdx = firstExternalCallIndex(stmts);
        if (externalCallIdx === -1) continue;

        const stateWriteIdx = firstStateWriteAfter(stmts, externalCallIdx);
        if (stateWriteIdx === -1) continue;

        const callStmt = stmts[externalCallIdx];
        const loc: FindingLocation = {
          file: filePath,
          line: (callStmt as BaseASTNode).loc?.start.line ?? 0,
          contract: contract.name,
          function: fn.name ?? undefined,
        };

        findings.push({
          severity: 'critical',
          title: `Reentrancy in \`${fn.name ?? '<fallback>'}\``,
          description:
            `\`${fn.name ?? '<fallback>'}\` in \`${contract.name}\` makes an external call ` +
            'before updating state. A malicious callee can re-enter this function ' +
            'and drain funds or corrupt state.',
          location: loc,
          recommendation:
            'Apply the Checks-Effects-Interactions pattern: update all state variables ' +
            'BEFORE making external calls. Alternatively, use a reentrancy guard ' +
            '(e.g., OpenZeppelin `ReentrancyGuard`).',
          detector: 'reentrancy',
        });
      }
    }

    return findings;
  },
};

const EXTERNAL_CALL_METHODS = new Set(['call', 'send', 'transfer', 'delegatecall']);

/** Flatten a block into a top-level ordered statement list (single level). */
function flattenStatements(block: Block): Statement[] {
  return block.statements;
}

/** Returns the index of the first external call statement, or -1. */
function firstExternalCallIndex(stmts: Statement[]): number {
  for (let i = 0; i < stmts.length; i++) {
    if (statementContainsExternalCall(stmts[i])) return i;
  }
  return -1;
}

/** Returns the index of the first state write after `after`, or -1. */
function firstStateWriteAfter(stmts: Statement[], after: number): number {
  for (let i = after + 1; i < stmts.length; i++) {
    if (statementIsStateWrite(stmts[i])) return i;
  }
  return -1;
}

function statementContainsExternalCall(stmt: Statement): boolean {
  const json = JSON.stringify(stmt);
  // External call patterns: .call{value: ...}, .send(), .transfer()
  for (const method of EXTERNAL_CALL_METHODS) {
    if (json.includes(`"memberName":"${method}"`)) return true;
  }
  return false;
}

function statementIsStateWrite(stmt: Statement): boolean {
  if (stmt.type !== 'ExpressionStatement') return false;
  const es = stmt as ExpressionStatement;
  if (!es.expression) return false;
  const exprJson = JSON.stringify(es.expression);
  // Heuristic: assignment expressions that touch balances/state mappings
  // We look for "=" operator in a BinaryOperation with a mapping/identifier on the left
  if (
    es.expression.type === 'BinaryOperation' &&
    (es.expression as { operator?: string }).operator === '='
  ) {
    return true;
  }
  // Also catch compound assignments: -=, +=
  return /\\"operator\\":\\"-=|\\+="/.test(exprJson) ||
    /"operator":"-="/.test(exprJson) ||
    /"operator":"\\+="/.test(exprJson);
}
