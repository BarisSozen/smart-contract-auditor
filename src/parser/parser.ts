// Solidity parser implementation - see HAS-4 for full implementation.
import type { SolidityAST } from './types.js';

export function parseSource(_source: string): SolidityAST {
  throw new Error('Not implemented yet — see HAS-4');
}

export async function parseFile(_filePath: string): Promise<SolidityAST> {
  throw new Error('Not implemented yet — see HAS-4');
}
