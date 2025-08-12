// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.16;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Dummy implementation contract that supports upgrade and logs methods called
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract DummyImplementation is UUPSUpgradeable {
  event MethodCalled(bytes4 selector);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public virtual initializer {}

  /// @inheritdoc UUPSUpgradeable
  function _authorizeUpgrade(address newImplementation) internal override {}

  // For making gas usage comparisons easier, I'm going to use different methods for each variant
  function callThruAMP() external {
    emit MethodCalled(this.callThruAMP.selector);
  }

  function callThru1967() external {
    emit MethodCalled(this.callThru1967.selector);
  }

  function callDirect() external {
    emit MethodCalled(this.callDirect.selector);
  }

  function callThruAMPSkippedMethod() external {
    emit MethodCalled(this.callThruAMPSkippedMethod.selector);
  }

  function callThruAMPNonSkippedMethod() external {
    emit MethodCalled(this.callThruAMPNonSkippedMethod.selector);
  }
}
