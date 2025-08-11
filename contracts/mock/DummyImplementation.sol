// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.16;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IDummy {
  function method1() external;
  function method2() external;
}

/**
 * @title Dummy implementation contract that supports upgrade and logs methods called
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract DummyImplementation is UUPSUpgradeable, IDummy {
  event MethodCalled(bytes4 selector);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public virtual initializer {}

  /// @inheritdoc UUPSUpgradeable
  function _authorizeUpgrade(address newImplementation) internal override {}

  function method1() external override {
    emit MethodCalled(IDummy.method1.selector);
  }

  function method2() external override {
    emit MethodCalled(IDummy.method2.selector);
  }
}
