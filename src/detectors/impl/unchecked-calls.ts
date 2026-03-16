import { getContracts, getFunctions } from '../../parser/parser.js';
import type {
  SourceUnit,
  FunctionDefinition,
  Statement,
  ExpressionStatement,
  FunctionCall,
  MemberAccess,
  BaseASTNode,
  Block,
} from '../../parser/types.js';
import type { Detector, Finding, FindingLocation } from '../types.js';

/**
 * Detects low-level calls (.call, .send, .delegatecall, .staticcall) whose
 * return value is not checked.
 *
 * An unchecked call silently fails: if the callee reverts or runs out of gas,
 * execution continues, which can leave the contract in an inconsistent state.
 */
export const uncheckedCallsDetector: Detector = {
  id: 'unchecked-calls',
  title: 'Unchecked External Call Return Value',
  severity: 'medium',

  detect(ast: SourceUnit, filePath: string): Finding[] {
    const findings: Finding[] = [];

    for (const contract of getContracts(ast)) {
      for (const fn of getFunctions(contract)) {
        if (!fn.body) continue;
        findUncheckedCalls(fn, fn.body.statements, filePath, contract.name, findings);
      }
    }

    return findings;
  },
};

const LOW_LEVEL_METHODS = new Set(['call', 'send', 'delegatecall', 'staticcall']);

function isLowLevelCall(node: BaseASTNode): boolean {
  if (node.type !== 'FunctionCall') return false;
  const fc = node as FunctionCall;

  // Direct .call/.send case
  if (fc.expression.type === 'MemberAccess') {
    return LOW_LEVEL_METHODS.has((fc.expression as MemberAccess).memberName);
  }

  // .call{value:...}("") — the parser wraps the MemberAccess in a NameValueExpression
  if (fc.expression.type === 'NameValueExpression') {
    const nve = fc.expression as unknown as { expression: BaseASTNode };
    if (nve.expression.type === 'MemberAccess') {
      return LOW_LEVEL_METHODS.has((nve.expression as unknown as MemberAccess).memberName);
    }
  }

  return false;
}

function findUncheckedCalls(
  fn: FunctionDefinition,
  statements: Statement[],
  filePath: string,
  contractName: string,
  findings: Finding[]
): void {
  for (const stmt of statements) {
    // Recurse into nested blocks
    if (stmt.type === 'Block') {
      findUncheckedCalls(fn, (stmt as Block).statements, filePath, contractName, findings);
      continue;
    }
    if (stmt.type === 'IfStatement') {
      const s = stmt as { trueBody?: BaseASTNode; falseBody?: BaseASTNode };
      if (s.trueBody?.type === 'Block')
        findUncheckedCalls(fn, (s.trueBody as Block).statements, filePath, contractName, findings);
      if (s.falseBody?.type === 'Block')
        findUncheckedCalls(fn, (s.falseBody as Block).statements, filePath, contractName, findings);
      continue;
    }

    // An ExpressionStatement whose expression IS a low-level call = unchecked
    // (Checked calls appear as VariableDeclarationStatement or are inside require())
    if (stmt.type === 'ExpressionStatement') {
      const es = stmt as ExpressionStatement;
      if (es.expression && isLowLevelCall(es.expression)) {
        const callNode = es.expression as FunctionCall;
        const ma = callNode.expression as MemberAccess;
        const loc: FindingLocation = {
          file: filePath,
          line: callNode.loc?.start.line ?? 0,
          contract: contractName,
          function: fn.name ?? undefined,
        };
        findings.push({
          severity: 'medium',
          title: `Unchecked Return Value of \`.${ma.memberName}()\``,
          description:
            `\`${fn.name ?? '<fallback>'}\` in \`${contractName}\` calls \`.${ma.memberName}()\` ` +
            'without checking the return value. A failed low-level call will not revert; ' +
            'the contract continues executing silently.',
          location: loc,
          recommendation:
            `Capture the return value: \`(bool ok,) = addr.${ma.memberName}(...);\` ` +
            'and revert on failure with `require(ok, "call failed")`.',
          detector: 'unchecked-calls',
        });
      }
    }
  }
}
