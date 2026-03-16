// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

contract Vault {
    address public admin;
    bool public paused;
    mapping(address => uint256) public deposits;

    constructor() {
        admin = msg.sender;
        paused = false;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    modifier validAmount(uint256 amount) {
        require(amount > 0, "Zero amount");
        _;
    }

    function deposit() external payable whenNotPaused validAmount(msg.value) {
        deposits[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external whenNotPaused validAmount(amount) {
        require(deposits[msg.sender] >= amount, "Insufficient");
        deposits[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function pause() external onlyAdmin {
        paused = true;
    }

    function unpause() external onlyAdmin {
        paused = false;
    }
}
