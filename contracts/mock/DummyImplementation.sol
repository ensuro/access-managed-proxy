// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.16;

import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {AMPUtils} from "../AMPUtils.sol";

/**
 * @title Dummy implementation contract that supports upgrade and logs methods called
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract DummyImplementation is UUPSUpgradeable, Initializable {
  event MethodCalled(bytes4 selector);
  event NonStandardMethodCalled(bytes msgData, uint256 value);

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

  function viewMethod() external view returns (address) {
    return msg.sender;
  }

  function pureMethod() external pure returns (uint256) {
    return 123456;
  }

  function setAuthority(address newAuthority) external {
    AMPUtils.setAccessManager(IAccessManager(newAuthority));
  }

  function setPassThruMethods(bytes4[] memory newPTMethods) external {
    AMPUtils.replacePassThruMethods(newPTMethods);
  }

  function checkCanCall(bytes memory something) external returns (bytes4 selector) {
    selector = AMPUtils.makeSelector(something);
    AMPUtils.checkCanCall(msg.sender, selector);
    emit MethodCalled(selector);
  }

  receive() external payable {
    emit MethodCalled(bytes4(keccak256("receive")));
    emit NonStandardMethodCalled("", msg.value);
  }

  fallback() external payable {
    emit MethodCalled(bytes4(keccak256("fallback")));
    emit NonStandardMethodCalled(msg.data, msg.value);
  }
}
