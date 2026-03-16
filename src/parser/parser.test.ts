import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSource, parseFile, getContracts, getFunctions, extractSolcVersion } from './parser.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixture = (name: string) => join(__dirname, 'fixtures', name);

// ─── parseSource ────────────────────────────────────────────────────────────

describe('parseSource', () => {
  it('parses a simple contract', () => {
    const result = parseSource(`
      pragma solidity ^0.8.0;
      contract Foo { }
    `);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('SourceUnit');
    expect(result.value.children.length).toBeGreaterThan(0);
  });

  it('returns a failure result (not throw) on syntax error', () => {
    const result = parseSource('contract Broken { function foo( { }');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBeTruthy();
    expect(result.error.errors.length).toBeGreaterThan(0);
  });

  it('attaches the filePath to parse failures', () => {
    const result = parseSource('not valid solidity', 'MyContract.sol');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.file).toBe('MyContract.sol');
  });
});

// ─── parseFile ──────────────────────────────────────────────────────────────

describe('parseFile', () => {
  it('parses simple.sol successfully', async () => {
    const result = await parseFile(fixture('simple.sol'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('SourceUnit');
  });

  it('parses inheritance.sol with multiple contracts', async () => {
    const result = await parseFile(fixture('inheritance.sol'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contracts = getContracts(result.value);
    expect(contracts.length).toBe(3); // IERC20, Ownable, ManagedToken
  });

  it('parses with-modifiers.sol', async () => {
    const result = await parseFile(fixture('with-modifiers.sol'));
    expect(result.ok).toBe(true);
  });

  it('returns failure result for invalid.sol (no throw)', async () => {
    const result = await parseFile(fixture('invalid.sol'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors.length).toBeGreaterThan(0);
  });

  it('throws (not returns) when file does not exist', async () => {
    await expect(parseFile('/nonexistent/path/Missing.sol')).rejects.toThrow();
  });
});

// ─── getContracts / getFunctions ────────────────────────────────────────────

describe('getContracts', () => {
  it('extracts contract definitions from a SourceUnit', () => {
    const result = parseSource(`
      pragma solidity ^0.8.0;
      contract A {}
      contract B {}
    `);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contracts = getContracts(result.value);
    expect(contracts.map((c) => c.name)).toEqual(['A', 'B']);
  });
});

describe('getFunctions', () => {
  it('extracts function definitions from a contract', () => {
    const result = parseSource(`
      pragma solidity ^0.8.0;
      contract C {
        function foo() external {}
        function bar() internal {}
      }
    `);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [contract] = getContracts(result.value);
    const fns = getFunctions(contract);
    expect(fns.map((f) => f.name)).toEqual(['foo', 'bar']);
  });
});

// ─── extractSolcVersion ─────────────────────────────────────────────────────

describe('extractSolcVersion', () => {
  it('extracts version from ^0.8.0', () => {
    const result = parseSource('pragma solidity ^0.8.0;\ncontract X {}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(extractSolcVersion(result.value)).toBe('0.8.0');
  });

  it('extracts version from >=0.7.0 <0.9.0', () => {
    const result = parseSource('pragma solidity >=0.7.0 <0.9.0;\ncontract X {}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(extractSolcVersion(result.value)).toBe('0.7.0');
  });

  it('returns null when no pragma present', () => {
    const result = parseSource('contract X {}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(extractSolcVersion(result.value)).toBeNull();
  });

  it('detects pre-0.8.0 (relevant for overflow checks)', async () => {
    const result = await parseFile(fixture('with-modifiers.sol'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const version = extractSolcVersion(result.value);
    expect(version).toBe('0.7.6');
  });
});

// ─── contract metadata ──────────────────────────────────────────────────────

describe('contract metadata', () => {
  it('extracts base contracts (inheritance)', async () => {
    const result = await parseFile(fixture('inheritance.sol'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contracts = getContracts(result.value);
    const managed = contracts.find((c) => c.name === 'ManagedToken');
    expect(managed).toBeDefined();
    const bases = managed!.baseContracts.map((b) => b.baseName.namePath);
    expect(bases).toContain('Ownable');
    expect(bases).toContain('IERC20');
  });

  it('identifies function visibility', async () => {
    const result = await parseFile(fixture('simple.sol'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [contract] = getContracts(result.value);
    const fns = getFunctions(contract);
    const transfer = fns.find((f) => f.name === 'transfer');
    expect(transfer?.visibility).toBe('external');
  });

  it('identifies function modifiers', async () => {
    const result = await parseFile(fixture('with-modifiers.sol'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [contract] = getContracts(result.value);
    const fns = getFunctions(contract);
    const deposit = fns.find((f) => f.name === 'deposit');
    const modifierNames = deposit?.modifiers.map((m) => m.name) ?? [];
    expect(modifierNames).toContain('whenNotPaused');
    expect(modifierNames).toContain('validAmount');
  });
});
