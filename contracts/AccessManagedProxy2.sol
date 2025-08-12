// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Packing} from "@openzeppelin/contracts/utils/Packing.sol";
import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";

/**
 * @title AccessManagedProxy2
 * @notice Proxy contract using IAccessManager to manage access control before delegating calls.
 * @dev It's a variant of ERC1967Proxy.
 *
 *      Currently the check is executed on any call received by the proxy contract even calls to view methods
 *      (staticcall). In the setup of the ACCESS_MANAGER permissions you would want to make all the views and pure
 *      functions enabled for the PUBLIC_ROLE.
 *
 *      For gas efficiency, the ACCESS_MANAGER is immutable, so take care you don't lose control of it, otherwise
 *      it will make your contract inaccesible or other bad things will happen.
 *
 *      Check https://forum.openzeppelin.com/t/accessmanagedproxy-is-a-good-idea/41917 for a discussion on the
 *      advantages and disadvantages of using it.
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract AccessManagedProxy2 is ERC1967Proxy {
  /**
   * @notice AccessManager contract that handles the permissions to access the implementation methods
   */
  IAccessManager public immutable ACCESS_MANAGER;
  bytes32 internal immutable PASS_THRU_METHODS_1;
  bytes32 internal immutable PASS_THRU_METHODS_2;
  bytes32 internal immutable PASS_THRU_METHODS_3;
  uint8 internal immutable PASS_THRU_METHODS_COUNT;

  // Error copied from IAccessManaged
  error AccessManagedUnauthorized(address caller);

  /**
   * @notice Constructor of the proxy, defining the implementation and the access manager
   * @dev Initializes the upgradeable proxy with an initial implementation specified by `implementation` and
   *      with `manager` as the ACCESS_MANAGER that will handle access control.
   *
   * @param implementation The initial implementation contract.
   * @param _data If nonempty, it's used as data in a delegate call to `implementation`. This will typically be an
   *              encoded function call, and allows initializing the storage of the proxy like a Solidity constructor.
   * @param manager The access manager that will handle access control
   * @param passThruMethods List of methods that will skip the access control validation, must be sorted
   *
   * Requirements:
   *
   * - If `data` is empty, `msg.value` must be zero.
   */
  constructor(
    address implementation,
    bytes memory _data,
    IAccessManager manager,
    bytes4[] memory passThruMethods
  ) payable ERC1967Proxy(implementation, _data) {
    ACCESS_MANAGER = manager;
    PASS_THRU_METHODS_COUNT = uint8(passThruMethods.length);
    bytes32[3] memory methods;
    // TODO: verify non zero and sorted
    for (uint8 i; i < PASS_THRU_METHODS_COUNT; ++i) {
      methods[i / 8] = Packing.replace_32_4(methods[i / 8], passThruMethods[i], (i % 8) * 4);
    }
    PASS_THRU_METHODS_1 = methods[0];
    PASS_THRU_METHODS_2 = methods[1];
    PASS_THRU_METHODS_3 = methods[2];
  }

  /**
   * @notice Intercepts the super._delegate call to implement access control
   * @dev Checks with the ACCESS_MANAGER if msg.sender is authorized to call the current call's function,
   * and if so, delegates the current call to `implementation`.
   * @param implementation The implementation contract
   *
   * This function does not return to its internal call site, it will return directly to the external caller.
   */
  function _delegate(address implementation) internal virtual override {
    bytes4 selector = bytes4(msg.data[0:4]);
    bool skip = false;
    for (uint8 i; i < PASS_THRU_METHODS_COUNT; ++i) {
      bytes32 methods = i < 8
        ? PASS_THRU_METHODS_1
        : i < 16
          ? PASS_THRU_METHODS_2
          : PASS_THRU_METHODS_3;
      bytes4 mSelector = Packing.extract_32_4(methods, (i % 8) * 4);
      if (mSelector < selector) continue;
      if (mSelector == selector) {
        skip = true;
      }
      break;
    }
    if (!skip) {
      (bool immediate, ) = ACCESS_MANAGER.canCall(msg.sender, address(this), selector);
      if (!immediate) revert AccessManagedUnauthorized(msg.sender);
    }
    super._delegate(implementation);
  }
}
