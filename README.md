# Smart Contract Auditor

Automated security auditing tool for Solidity/EVM smart contracts. Parses Solidity source files, runs vulnerability detectors, and generates structured audit reports.

## Features

- **Solidity AST Parser** — parses `.sol` files into a typed AST using `@solidity-parser/parser`
- **Vulnerability Detectors** (plugin pattern):
  - Reentrancy (external call before state change)
  - Unchecked external calls
  - Access control issues
  - Integer overflow/underflow (pre-0.8.0 contracts)
  - `tx.origin` authentication
- **Report Generator** — JSON and Markdown output, client-ready
- **CLI** — `sca audit <path>` with format and severity filters

## Setup

```bash
pnpm install
pnpm build
```

## Usage

```bash
# Audit a single file
sca audit contracts/MyContract.sol

# Audit a directory, output JSON + Markdown to ./reports/
sca audit contracts/ --format both --output ./reports/

# Only show critical and high findings
sca audit contracts/ --severity critical,high
```

## Development

```bash
pnpm test          # run tests
pnpm test:watch    # watch mode
pnpm lint          # lint src/
pnpm typecheck     # type-check without building
pnpm build         # compile to dist/
```

## Architecture

```
src/
├── parser/      AST generation from Solidity source
├── detectors/   Vulnerability detector plugins
├── reporter/    Report generation (JSON + Markdown)
└── cli/         Commander.js CLI entry point
```

Each detector implements the `Detector` interface:

```typescript
interface Detector {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  detect(ast: SolidityAST, filePath: string): Finding[];
}
```

## License

MIT
