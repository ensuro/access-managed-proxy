// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.16;

import {DummyImplementation} from "./DummyImplementation.sol";

/**
 * @title Dummy implementation contract that supports upgrade and logs methods called
 * @dev Variant used to measure gas usage of the AccessManagedProxyM variants (using mutable ACCESS_MANAGER)
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract DummyImplementationAMPM is DummyImplementation {
  function callThruAMPM() external {
    emit MethodCalled(this.callThruAMPM.selector);
  }
}
