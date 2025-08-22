// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AccessManagedProxy} from "./AccessManagedProxy.sol";

/**
 * @title AMPUtils
 * @dev Utility functions for doing custom access control rules, for contracts deployed
 *      with AccessManagedProxy
 * @author Ensuro
 */
library AMPUtils {
  // Error copied from IAccessManaged
  error AccessManagedUnauthorized(address caller);

  /**
   * @dev Checks if the user can call a particular selector, assuming the calling contract was deployed as an AMP.
   *
   * @param user The user for which you want to check the access, typically msg.sender
   * @param selector The selector of the method called (or a fake selector generated with makeSelector or another way)
   */
  function checkCanCall(address user, bytes4 selector) internal view {
    (bool immediate, ) = AccessManagedProxy(payable(address(this))).ACCESS_MANAGER().canCall(
      user,
      address(this),
      selector
    );
    require(immediate, AccessManagedUnauthorized(user));
  }

  /**
   * @dev Standard way of creating "fake selectors" (not necessarily tied to a method call) for specific permissions
   */
  function makeSelector(bytes memory something) internal pure returns (bytes4) {
    return bytes4(keccak256(something));
  }
}
