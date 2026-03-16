// TypeScript types for the Solidity AST nodes we care about.
// Full implementation in HAS-4.

export interface SolidityAST {
  type: 'SourceUnit';
  children: ASTNode[];
}

export type ASTNode =
  | ContractDefinition
  | FunctionDefinition
  | StateVariableDeclaration
  | ImportDirective
  | PragmaDirective;

export interface ContractDefinition {
  type: 'ContractDefinition';
  name: string;
  baseContracts: string[];
  subNodes: ASTNode[];
}

export interface FunctionDefinition {
  type: 'FunctionDefinition';
  name: string | null;
  visibility: 'public' | 'external' | 'internal' | 'private';
  stateMutability: 'pure' | 'view' | 'payable' | 'nonpayable';
  modifiers: string[];
  parameters: Parameter[];
  body: Statement[] | null;
}

export interface StateVariableDeclaration {
  type: 'StateVariableDeclaration';
  variables: Variable[];
}

export interface ImportDirective {
  type: 'ImportDirective';
  path: string;
}

export interface PragmaDirective {
  type: 'PragmaDirective';
  name: string;
  value: string;
}

export interface Parameter {
  name: string | null;
  typeName: string;
}

export interface Variable {
  name: string;
  typeName: string;
  visibility: 'public' | 'internal' | 'private';
}

export interface Statement {
  type: string;
  [key: string]: unknown;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}
