// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";
import {IAccessManagedProxy} from "./interfaces/IAccessManagedProxy.sol";

/**
 * @title AMPUtils
 * @dev Utility functions for doing custom access control rules, for contracts deployed
 *      with AccessManagedProxy
 * @author Ensuro
 */
library AMPUtils {
  // Error copied from IAccessManaged
  error AccessManagedUnauthorized(address caller);

  struct AccessManagedProxyStorage {
    IAccessManager accessManager;
    bytes4[] passThruMethods; // This is used for observability
    mapping(bytes4 => bool) skipAc; // This is the used for actual lookup
  }

  /**
   * @notice Storage slot with the address of the current access mananger.
   * @dev Computed as: `keccak256(
   *    abi.encode(uint256(keccak256("ensuro.storage.AccessManagedProxy")) - 1)
   * ) & ~bytes32(uint256(0xff))
   */
  // solhint-disable-next-line const-name-snakecase
  bytes32 internal constant AccessManagedProxyStorageLocation =
    0x787c9d7ac910d64252bcea05acd5b7af6d59644e0451a8bb5674587555049c00;

  function getAccessManagedProxyStorage() internal pure returns (AccessManagedProxyStorage storage $) {
    // solhint-disable-next-line no-inline-assembly
    assembly {
      $.slot := AccessManagedProxyStorageLocation
    }
  }

  function setAccessManager(IAccessManager accessManager) internal {
    if (address(accessManager).code.length == 0) {
      revert IAccessManagedProxy.AccessManagedInvalidAuthority(address(accessManager));
    }
    getAccessManagedProxyStorage().accessManager = accessManager;
    emit IAccessManagedProxy.AuthorityUpdated(address(accessManager));
  }

  function setPassThruMethods(bytes4[] memory passThruMethods) internal {
    AccessManagedProxyStorage storage $ = AMPUtils.getAccessManagedProxyStorage();
    $.passThruMethods = new bytes4[](passThruMethods.length);
    for (uint256 i; i < passThruMethods.length; ++i) {
      $.passThruMethods[i] = passThruMethods[i];
      $.skipAc[passThruMethods[i]] = true;
    }
    emit IAccessManagedProxy.PassThruMethodsChanged(passThruMethods);
  }

  function replacePassThruMethods(bytes4[] memory newPassThruMethods) internal {
    AccessManagedProxyStorage storage $ = AMPUtils.getAccessManagedProxyStorage();
    bytes4[] memory oldPassThruMethods = $.passThruMethods;
    for (uint256 i; i < oldPassThruMethods.length; ++i) {
      $.skipAc[oldPassThruMethods[i]] = false;
    }
    setPassThruMethods(newPassThruMethods);
  }

  /**
   * @dev Checks if the user can call a particular selector, assuming the calling contract was deployed as an AMP.
   *
   * @param user The user for which you want to check the access, typically msg.sender
   * @param selector The selector of the method called (or a fake selector generated with makeSelector or another way)
   */
  function checkCanCall(address user, bytes4 selector) internal view {
    (bool immediate, ) = IAccessManagedProxy(payable(address(this))).ACCESS_MANAGER().canCall(
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
