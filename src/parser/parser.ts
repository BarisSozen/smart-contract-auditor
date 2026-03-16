import { readFile } from 'node:fs/promises';
import { parse, visit as _visit, ParserError } from '@solidity-parser/parser';
import type {
  SourceUnit,
  ContractDefinition,
  FunctionDefinition,
  ASTNode,
  ASTVisitor,
  ParseResult,
  ParseFailure,
} from './types.js';

export type { SourceUnit, ContractDefinition, FunctionDefinition, ASTNode };

/**
 * Parse a Solidity source string into an AST.
 * Returns a Result — never throws on parse errors.
 */
export function parseSource(source: string, filePath = '<source>'): ParseResult<SourceUnit> {
  try {
    // Cast: the library's internal type is compatible but not re-exported.
    const ast = parse(source, { loc: true, range: true, tolerant: false }) as unknown as SourceUnit;
    return { ok: true, value: ast };
  } catch (err) {
    if (err instanceof ParserError) {
      const failure: ParseFailure = {
        file: filePath,
        message: err.message,
        errors: err.errors,
      };
      return { ok: false, error: failure };
    }
    throw new Error(`Unexpected error parsing ${filePath}: ${String(err)}`);
  }
}

/**
 * Read a .sol file from disk and parse it.
 * Returns a Result — never throws on parse errors.
 */
export async function parseFile(filePath: string): Promise<ParseResult<SourceUnit>> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read file ${filePath}: ${String(err)}`);
  }
  return parseSource(source, filePath);
}

/**
 * Walk the AST with a visitor map.
 * Usage: visit(ast, { FunctionDefinition: (node) => { ... } })
 */
export function visit(node: SourceUnit, visitor: ASTVisitor): void {
  _visit(node as unknown as Parameters<typeof _visit>[0], visitor as Parameters<typeof _visit>[1]);
}

/**
 * Extract all ContractDefinition nodes from a SourceUnit.
 */
export function getContracts(ast: SourceUnit): ContractDefinition[] {
  return ast.children.filter(
    (n): n is ContractDefinition => n.type === 'ContractDefinition'
  );
}

/**
 * Extract all FunctionDefinition nodes from a contract.
 */
export function getFunctions(contract: ContractDefinition): FunctionDefinition[] {
  return contract.subNodes.filter(
    (n): n is FunctionDefinition => n.type === 'FunctionDefinition'
  );
}

/**
 * Extract the solc version from a pragma directive.
 * e.g. "^0.7.6" → "0.7.6", ">=0.7.0 <0.9.0" → "0.7.0"
 * Returns null if no solidity pragma is found.
 */
export function extractSolcVersion(ast: SourceUnit): string | null {
  for (const node of ast.children) {
    if (node.type === 'PragmaDirective' && (node as { name?: string }).name === 'solidity') {
      const pragma = node as { value: string };
      const match = pragma.value.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : pragma.value.trim();
    }
  }
  return null;
}
