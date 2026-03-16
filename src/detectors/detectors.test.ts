import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/parser.js';
import { txOriginDetector } from './impl/tx-origin.js';
import { uncheckedCallsDetector } from './impl/unchecked-calls.js';
import { integerOverflowDetector } from './impl/integer-overflow.js';
import { accessControlDetector } from './impl/access-control.js';
import { reentrancyDetector } from './impl/reentrancy.js';
import type { SourceUnit } from '../parser/types.js';

function parse(src: string): SourceUnit {
  const r = parseSource(src);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

// ─── tx-origin ──────────────────────────────────────────────────────────────

describe('txOriginDetector', () => {
  it('flags tx.origin used in a function', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Vulnerable {
        address owner;
        function withdraw() external {
          require(tx.origin == owner, "not owner");
          payable(msg.sender).transfer(address(this).balance);
        }
      }
    `);
    const findings = txOriginDetector.detect(ast, 'test.sol');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].detector).toBe('tx-origin');
    expect(findings[0].severity).toBe('high');
  });

  it('does NOT flag msg.sender used for auth', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Safe {
        address owner;
        function withdraw() external {
          require(msg.sender == owner, "not owner");
          payable(msg.sender).transfer(address(this).balance);
        }
      }
    `);
    const findings = txOriginDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });
});

// ─── unchecked-calls ────────────────────────────────────────────────────────

describe('uncheckedCallsDetector', () => {
  it('flags .call() without capturing return value', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Vulnerable {
        function pay(address payable to, uint amount) external {
          to.call{value: amount}("");
        }
      }
    `);
    const findings = uncheckedCallsDetector.detect(ast, 'test.sol');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].detector).toBe('unchecked-calls');
  });

  it('flags .send() without checking return', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Vulnerable {
        function pay(address payable to) external {
          to.send(1 ether);
        }
      }
    `);
    const findings = uncheckedCallsDetector.detect(ast, 'test.sol');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('does NOT flag when return value is captured', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Safe {
        function pay(address payable to, uint amount) external {
          (bool ok,) = to.call{value: amount}("");
          require(ok, "failed");
        }
      }
    `);
    const findings = uncheckedCallsDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });
});

// ─── integer-overflow ───────────────────────────────────────────────────────

describe('integerOverflowDetector', () => {
  it('flags arithmetic in pre-0.8.0 contract', () => {
    const ast = parse(`
      pragma solidity ^0.7.6;
      contract Vulnerable {
        uint public total;
        function add(uint amount) external {
          total = total + amount;
        }
      }
    `);
    const findings = integerOverflowDetector.detect(ast, 'test.sol');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].detector).toBe('integer-overflow');
  });

  it('does NOT flag arithmetic in >= 0.8.0', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Safe {
        uint public total;
        function add(uint amount) external {
          total = total + amount;
        }
      }
    `);
    const findings = integerOverflowDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });

  it('does NOT flag pre-0.8.0 contract using SafeMath', () => {
    const ast = parse(`
      pragma solidity ^0.7.6;
      import "./SafeMath.sol";
      contract Safe {
        using SafeMath for uint256;
        uint public total;
        function add(uint amount) external {
          total = total.add(amount);
        }
      }
    `);
    const findings = integerOverflowDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });

  it('flags ++ operator in pre-0.8.0', () => {
    const ast = parse(`
      pragma solidity ^0.6.0;
      contract Vulnerable {
        uint public counter;
        function inc() external {
          counter++;
        }
      }
    `);
    const findings = integerOverflowDetector.detect(ast, 'test.sol');
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ─── access-control ─────────────────────────────────────────────────────────

describe('accessControlDetector', () => {
  it('flags public withdraw() with no modifier', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Vulnerable {
        function withdraw() public {
          payable(msg.sender).transfer(address(this).balance);
        }
      }
    `);
    const findings = accessControlDetector.detect(ast, 'test.sol');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].detector).toBe('access-control');
  });

  it('does NOT flag withdraw() protected by onlyOwner modifier', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Safe {
        address owner = msg.sender;
        modifier onlyOwner() {
          require(msg.sender == owner);
          _;
        }
        function withdraw() public onlyOwner {
          payable(msg.sender).transfer(address(this).balance);
        }
      }
    `);
    const findings = accessControlDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });

  it('does NOT flag non-sensitive functions', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Safe {
        uint public value;
        function getValue() external view returns (uint) {
          return value;
        }
        function setValue(uint v) external {
          value = v;
        }
      }
    `);
    const findings = accessControlDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });

  it('does NOT flag interface functions', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      interface IVault {
        function withdraw(uint amount) external;
      }
    `);
    const findings = accessControlDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });
});

// ─── reentrancy ─────────────────────────────────────────────────────────────

describe('reentrancyDetector', () => {
  it('flags external call before state update', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Vulnerable {
        mapping(address => uint) public balances;
        function withdraw(uint amount) external {
          require(balances[msg.sender] >= amount);
          (bool ok,) = msg.sender.call{value: amount}("");
          require(ok);
          balances[msg.sender] -= amount;
        }
      }
    `);
    const findings = reentrancyDetector.detect(ast, 'test.sol');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].detector).toBe('reentrancy');
    expect(findings[0].severity).toBe('critical');
  });

  it('does NOT flag when state is updated before external call (CEI pattern)', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Safe {
        mapping(address => uint) public balances;
        function withdraw(uint amount) external {
          require(balances[msg.sender] >= amount);
          balances[msg.sender] -= amount;
          (bool ok,) = msg.sender.call{value: amount}("");
          require(ok);
        }
      }
    `);
    const findings = reentrancyDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });

  it('does NOT flag functions with no external calls', () => {
    const ast = parse(`
      pragma solidity ^0.8.0;
      contract Safe {
        uint public counter;
        function increment() external {
          counter += 1;
        }
      }
    `);
    const findings = reentrancyDetector.detect(ast, 'test.sol');
    expect(findings.length).toBe(0);
  });
});
