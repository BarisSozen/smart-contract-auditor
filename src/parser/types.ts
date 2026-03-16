// AST types consumed by detectors and the reporter.
// These mirror @solidity-parser/parser's internal types — keeping our own
// definitions decouples us from the library's internal module paths.

export interface Position {
  line: number;
  column: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface BaseASTNode {
  type: string;
  loc?: SourceLocation;
  range?: [number, number];
}

export interface SourceUnit extends BaseASTNode {
  type: 'SourceUnit';
  children: ASTNode[];
}

export interface PragmaDirective extends BaseASTNode {
  type: 'PragmaDirective';
  name: string;
  value: string;
}

export interface ImportDirective extends BaseASTNode {
  type: 'ImportDirective';
  path: string;
}

export interface InheritanceSpecifier extends BaseASTNode {
  type: 'InheritanceSpecifier';
  baseName: { namePath: string };
  arguments: ASTNode[];
}

export interface ContractDefinition extends BaseASTNode {
  type: 'ContractDefinition';
  name: string;
  kind: 'contract' | 'library' | 'interface';
  baseContracts: InheritanceSpecifier[];
  subNodes: ASTNode[];
}

export interface StateVariableDeclaration extends BaseASTNode {
  type: 'StateVariableDeclaration';
  variables: VariableDeclaration[];
  initialValue: Expression | null;
}

export interface VariableDeclaration extends BaseASTNode {
  type: 'VariableDeclaration';
  name: string | null;
  typeName: ASTNode | null;
  visibility?: 'public' | 'private' | 'internal' | 'default';
  isStateVar?: boolean;
  storageLocation?: string | null;
  expression?: Expression | null;
}

export interface ModifierDefinition extends BaseASTNode {
  type: 'ModifierDefinition';
  name: string;
  parameters: VariableDeclaration[] | null;
  body: Block | null;
}

export interface ModifierInvocation extends BaseASTNode {
  type: 'ModifierInvocation';
  name: string;
  arguments: Expression[] | null;
}

export interface FunctionDefinition extends BaseASTNode {
  type: 'FunctionDefinition';
  name: string | null;
  visibility: 'default' | 'external' | 'internal' | 'public' | 'private';
  stateMutability: 'pure' | 'constant' | 'payable' | 'view' | null;
  modifiers: ModifierInvocation[];
  parameters: VariableDeclaration[];
  returnParameters: VariableDeclaration[] | null;
  body: Block | null;
  isConstructor: boolean;
  isFallback: boolean;
  isReceiveEther: boolean;
  isVirtual: boolean;
  override: ASTNode[] | null;
}

export interface EventDefinition extends BaseASTNode {
  type: 'EventDefinition';
  name: string;
  parameters: VariableDeclaration[];
}

export interface Block extends BaseASTNode {
  type: 'Block';
  statements: Statement[];
}

export type Statement =
  | ExpressionStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | DoWhileStatement
  | ReturnStatement
  | EmitStatement
  | ThrowStatement
  | UncheckedStatement
  | Block
  | BaseASTNode;

export interface ExpressionStatement extends BaseASTNode {
  type: 'ExpressionStatement';
  expression: Expression | null;
}

export interface IfStatement extends BaseASTNode {
  type: 'IfStatement';
  condition: Expression;
  trueBody: Statement;
  falseBody: Statement | null;
}

export interface ForStatement extends BaseASTNode {
  type: 'ForStatement';
  initExpression: Statement | null;
  conditionExpression?: Expression;
  loopExpression: ExpressionStatement;
  body: Statement;
}

export interface WhileStatement extends BaseASTNode {
  type: 'WhileStatement';
  condition: Expression;
  body: Statement;
}

export interface DoWhileStatement extends BaseASTNode {
  type: 'DoWhileStatement';
  condition: Expression;
  body: Statement;
}

export interface ReturnStatement extends BaseASTNode {
  type: 'ReturnStatement';
  expression: Expression | null;
}

export interface EmitStatement extends BaseASTNode {
  type: 'EmitStatement';
  eventCall: FunctionCall;
}

export interface ThrowStatement extends BaseASTNode {
  type: 'ThrowStatement';
}

export interface UncheckedStatement extends BaseASTNode {
  type: 'UncheckedStatement';
  block: Block;
}

export type Expression =
  | FunctionCall
  | MemberAccess
  | Identifier
  | BinaryOperation
  | UnaryOperation
  | IndexAccess
  | BaseASTNode;

export interface FunctionCall extends BaseASTNode {
  type: 'FunctionCall';
  expression: Expression;
  arguments: Expression[];
  names: string[];
}

export interface MemberAccess extends BaseASTNode {
  type: 'MemberAccess';
  expression: Expression;
  memberName: string;
}

export interface Identifier extends BaseASTNode {
  type: 'Identifier';
  name: string;
}

export interface BinaryOperation extends BaseASTNode {
  type: 'BinaryOperation';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryOperation extends BaseASTNode {
  type: 'UnaryOperation';
  operator: string;
  subExpression: Expression;
  isPrefix: boolean;
}

export interface IndexAccess extends BaseASTNode {
  type: 'IndexAccess';
  base: Expression;
  index: Expression | null;
}

export type ASTNode =
  | SourceUnit
  | PragmaDirective
  | ImportDirective
  | ContractDefinition
  | InheritanceSpecifier
  | StateVariableDeclaration
  | VariableDeclaration
  | ModifierDefinition
  | ModifierInvocation
  | FunctionDefinition
  | EventDefinition
  | Block
  | Statement
  | Expression
  | BaseASTNode;

/** Visitor map for walking the AST. */
export type ASTVisitor = Partial<{
  [K in ASTNode['type']]: (node: Extract<ASTNode, { type: K }>) => void;
}>;

/** Structured parse error with file context. */
export interface ParseFailure {
  file: string;
  message: string;
  errors: Array<{ message: string; line: number; column: number }>;
}

/** Result type: forces callers to handle parse failures explicitly. */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ParseFailure };
