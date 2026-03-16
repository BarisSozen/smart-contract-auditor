import { getContracts, getFunctions } from '../../parser/parser.js';
import type {
  SourceUnit,
  FunctionDefinition,
  Statement,
  Block,
  ExpressionStatement,
  BinaryOperation,
  UnaryOperation,
  BaseASTNode,
} from '../../parser/types.js';
import type { Detector, Finding, FindingLocation } from '../types.js';

/**
 * Detects integer arithmetic (+, -, *, ++) on uint/int types in contracts
 * compiled with Solidity < 0.8.0 that don't use SafeMath.
 *
 * In Solidity < 0.8.0, arithmetic silently wraps (no built-in overflow checks).
 * SafeMath library calls or the `using SafeMath` directive are safe patterns.
 * In >= 0.8.0, overflow reverts by default so no finding is raised.
 */
export const integerOverflowDetector: Detector = {
  id: 'integer-overflow',
  title: 'Integer Overflow / Underflow (pre-0.8.0)',
  severity: 'high',

  detect(ast: SourceUnit, filePath: string): Finding[] {
    // Only applies to contracts compiled with Solidity < 0.8.0
    const pragmaVersion = getPragmaVersion(ast);
    if (!pragmaVersion || !isPreSafeMath(pragmaVersion)) {
      return [];
    }

    const usesSafeMath = contractUsesSafeMath(ast);
    if (usesSafeMath) return [];

    const findings: Finding[] = [];

    for (const contract of getContracts(ast)) {
      for (const fn of getFunctions(contract)) {
        if (!fn.body) continue;
        collectArithmetic(fn, fn.body.statements, filePath, contract.name, findings);
      }
    }

    return deduplicate(findings);
  },
};

const OVERFLOW_OPS = new Set(['+', '-', '*', '+=', '-=', '*=']);

function collectArithmetic(
  fn: FunctionDefinition,
  statements: Statement[],
  filePath: string,
  contractName: string,
  findings: Finding[]
): void {
  for (const stmt of statements) {
    if (stmt.type === 'Block') {
      collectArithmetic(fn, (stmt as Block).statements, filePath, contractName, findings);
      continue;
    }
    if (stmt.type === 'ExpressionStatement') {
      const expr = (stmt as ExpressionStatement).expression;
      if (!expr) continue;
      walkExpr(expr as BaseASTNode, fn, filePath, contractName, findings);
    }
  }
}

function walkExpr(
  node: BaseASTNode,
  fn: FunctionDefinition,
  filePath: string,
  contractName: string,
  findings: Finding[]
): void {
  if (node.type === 'BinaryOperation') {
    const bin = node as BinaryOperation;
    if (OVERFLOW_OPS.has(bin.operator)) {
      const loc: FindingLocation = {
        file: filePath,
        line: node.loc?.start.line ?? 0,
        contract: contractName,
        function: fn.name ?? undefined,
      };
      findings.push({
        severity: 'high',
        title: `Integer Overflow/Underflow on \`${bin.operator}\` (Solidity < 0.8.0)`,
        description:
          `Arithmetic operation \`${bin.operator}\` in \`${fn.name ?? '<fallback>'}\` of ` +
          `\`${contractName}\` may overflow or underflow. The contract uses Solidity < 0.8.0 ` +
          'where arithmetic does not revert on overflow.',
        location: loc,
        recommendation:
          'Use `SafeMath` library for arithmetic, or upgrade to Solidity ≥ 0.8.0 ' +
          'where overflow reverts by default.',
        detector: 'integer-overflow',
      });
    }
    walkExpr(bin.left as BaseASTNode, fn, filePath, contractName, findings);
    walkExpr(bin.right as BaseASTNode, fn, filePath, contractName, findings);
  } else if (node.type === 'UnaryOperation') {
    const un = node as UnaryOperation;
    if (un.operator === '++' || un.operator === '--') {
      const loc: FindingLocation = {
        file: filePath,
        line: node.loc?.start.line ?? 0,
        contract: contractName,
        function: fn.name ?? undefined,
      };
      findings.push({
        severity: 'high',
        title: `Integer Overflow/Underflow on \`${un.operator}\` (Solidity < 0.8.0)`,
        description:
          `Increment/decrement \`${un.operator}\` in \`${fn.name ?? '<fallback>'}\` of ` +
          `\`${contractName}\` may overflow. Solidity < 0.8.0 does not check for overflow.`,
        location: loc,
        recommendation: 'Use SafeMath or upgrade to Solidity ≥ 0.8.0.',
        detector: 'integer-overflow',
      });
    }
  }
}

function getPragmaVersion(ast: SourceUnit): string | null {
  for (const node of ast.children) {
    if (node.type === 'PragmaDirective' && (node as { name?: string }).name === 'solidity') {
      const match = (node as { value: string }).value.match(/(\d+)\.(\d+)\.(\d+)/);
      return match ? match[0] : null;
    }
  }
  return null;
}

function isPreSafeMath(version: string): boolean {
  const [, minor] = version.split('.').map(Number);
  return (minor ?? 8) < 8;
}

function contractUsesSafeMath(ast: SourceUnit): boolean {
  let found = false;
  for (const node of ast.children) {
    if (node.type === 'ContractDefinition') {
      const contract = node as { subNodes: BaseASTNode[] };
      for (const sub of contract.subNodes) {
        if (sub.type === 'UsingForDeclaration') {
          const ufd = sub as { libraryName?: string | null };
          if (ufd.libraryName?.toLowerCase().includes('safemath')) {
            found = true;
          }
        }
      }
    }
  }
  return found;
}

function deduplicate(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.location.line}:${f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
