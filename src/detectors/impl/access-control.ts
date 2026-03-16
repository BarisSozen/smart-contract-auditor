import { getContracts, getFunctions } from '../../parser/parser.js';
import type { SourceUnit, FunctionDefinition, BaseASTNode } from '../../parser/types.js';
import type { Detector, Finding, FindingLocation } from '../types.js';

/**
 * Detects public/external functions with sensitive names that lack access modifiers.
 * Sensitive operations: withdraw, transfer, mint, burn, pause, unpause, setOwner,
 * transferOwnership, upgrade, destroy, selfdestruct, initialize.
 *
 * "Precise over comprehensive" — we only flag when:
 * 1. The function is public or external
 * 2. The name matches a known sensitive pattern
 * 3. The function has NO modifiers
 * 4. The function body does NOT contain an explicit owner/admin check (require/revert)
 */
export const accessControlDetector: Detector = {
  id: 'access-control',
  title: 'Missing Access Control on Sensitive Function',
  severity: 'high',

  detect(ast: SourceUnit, filePath: string): Finding[] {
    const findings: Finding[] = [];

    for (const contract of getContracts(ast)) {
      // Skip interfaces (no bodies)
      if (contract.kind === 'interface') continue;

      for (const fn of getFunctions(contract)) {
        if (!isSensitiveExposedFunction(fn)) continue;
        if (hasAccessModifier(fn, contract)) continue;
        if (hasExplicitOwnerCheck(fn)) continue;

        const loc: FindingLocation = {
          file: filePath,
          line: fn.loc?.start.line ?? 0,
          contract: contract.name,
          function: fn.name ?? undefined,
        };

        findings.push({
          severity: 'high',
          title: `Missing Access Control on \`${fn.name}()\``,
          description:
            `Function \`${fn.name}()\` in \`${contract.name}\` is ` +
            `\`${fn.visibility}\` and appears to be a privileged operation, ` +
            'but has no access control modifier or explicit ownership check. ' +
            'Anyone can call it.',
          location: loc,
          recommendation:
            'Add an access control modifier (e.g., `onlyOwner`, `onlyAdmin`) or ' +
            'an explicit `require(msg.sender == owner)` check.',
          detector: 'access-control',
        });
      }
    }

    return findings;
  },
};

const SENSITIVE_PATTERNS = [
  /^withdraw/i,
  /^transfer(Ownership|From)?$/i,
  /^mint$/i,
  /^burn$/i,
  /^pause$/i,
  /^unpause$/i,
  /^setOwner$/i,
  /^upgradeTo$/i,
  /^initialize$/i,
  /^destroy$/i,
  /^selfdestruct/i,
  /^setAdmin$/i,
  /^setFee$/i,
];

function isSensitiveExposedFunction(fn: FunctionDefinition): boolean {
  if (!fn.name) return false; // constructor / fallback
  if (fn.visibility !== 'public' && fn.visibility !== 'external') return false;
  return SENSITIVE_PATTERNS.some((p) => p.test(fn.name!));
}

function hasAccessModifier(
  fn: FunctionDefinition,
  contract: { subNodes: BaseASTNode[] }
): boolean {
  if (fn.modifiers.length === 0) return false;
  // Check that at least one modifier is defined in the contract (not a built-in)
  const modifierNames = new Set(
    contract.subNodes
      .filter((n) => n.type === 'ModifierDefinition')
      .map((n) => (n as unknown as { name: string }).name)
  );
  return fn.modifiers.some(
    (m) =>
      modifierNames.has(m.name) ||
      // Common access control modifier names from libraries
      /owner|admin|role|auth|only|guard/i.test(m.name)
  );
}

function hasExplicitOwnerCheck(fn: FunctionDefinition): boolean {
  if (!fn.body) return false;
  return bodyContainsOwnerCheck(JSON.stringify(fn.body));
}

function bodyContainsOwnerCheck(bodyJson: string): boolean {
  // Heuristic: look for require/revert patterns involving owner/admin/msg.sender
  return (
    /require/.test(bodyJson) &&
    /(owner|admin|msg\.sender|msg\\\.sender)/.test(bodyJson)
  );
}
