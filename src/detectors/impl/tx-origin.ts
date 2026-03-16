import { visit, getContracts, getFunctions } from '../../parser/parser.js';
import type { SourceUnit, FunctionDefinition, BaseASTNode } from '../../parser/types.js';
import type { Detector, Finding, FindingLocation } from '../types.js';

/**
 * Detects use of tx.origin for authentication instead of msg.sender.
 * tx.origin returns the original transaction sender, making contracts
 * vulnerable to phishing attacks where a victim's contract is used as relay.
 */
export const txOriginDetector: Detector = {
  id: 'tx-origin',
  title: 'tx.origin Authentication',
  severity: 'high',

  detect(ast: SourceUnit, filePath: string): Finding[] {
    const findings: Finding[] = [];

    for (const contract of getContracts(ast)) {
      for (const fn of getFunctions(contract)) {
        visit(ast, {
          MemberAccess: (node: BaseASTNode) => {
            const ma = node as unknown as { memberName: string; expression: BaseASTNode & { name?: string } };
            if (
              ma.memberName === 'origin' &&
              ma.expression.type === 'Identifier' &&
              ma.expression.name === 'tx'
            ) {
              // Only flag when used inside a conditional (likely auth check)
              const loc: FindingLocation = {
                file: filePath,
                line: node.loc?.start.line ?? 0,
                contract: contract.name,
                function: fn.name ?? undefined,
              };
              findings.push({
                severity: 'high',
                title: 'Use of tx.origin for Authentication',
                description:
                  `Function \`${fn.name ?? '<fallback>'}\` in \`${contract.name}\` uses ` +
                  '`tx.origin` for authentication. An attacker can trick a victim into calling a ' +
                  'malicious contract which then calls this contract, bypassing the tx.origin check.',
                location: loc,
                recommendation:
                  'Replace `tx.origin` with `msg.sender` for access control checks.',
                detector: 'tx-origin',
              });
            }
          },
        } as Parameters<typeof visit>[1]);
      }
    }

    // Deduplicate by line (visit recurses and may hit the same node multiple times)
    const seen = new Set<string>();
    return findings.filter((f) => {
      const key = `${f.location.file}:${f.location.line}:${f.location.contract}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};
