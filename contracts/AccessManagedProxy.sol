// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";
import {IAccessManagedProxy} from "./interfaces/IAccessManagedProxy.sol";
import {AccessManagedProxyBase} from "./AccessManagedProxyBase.sol";
import {AMPUtils} from "./AMPUtils.sol";

/**
 * @title AccessManagedProxy
 * @notice Proxy contract using IAccessManager to manage access control before delegating calls (mutable version)
 * @dev It's a variant of ERC1967Proxy.
 *
 *      Currently the check is executed on any call received by the proxy contract (even calls to view methods, i.e.
 *      staticcall). For gas efficiency, you can also have `passThruMethods`, and for those methods it will skip
 *      the call to the AccessManager, calling directly to the implementation contract.
 *
 *      The accessManager and the passThruMethods are in the storage, but this contract doesn't include any method
 *      to modify them. They should be modified by the implementation contract (check AMPUtils for functions that
 *      encapsulate these operations).
 *
 *      Check https://forum.openzeppelin.com/t/accessmanagedproxy-is-a-good-idea/41917 for a discussion on the
 *      advantages and disadvantages of using it. Also https://www.youtube.com/watch?v=DKdwJ9Ap9vM for a presentation
 *      on this approach.
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract AccessManagedProxy is AccessManagedProxyBase {
  /// @custom:storage-location erc7201:ensuro.storage.AccessManagedProxy
  /// For struct AMPUtils.AccessManagedProxyStorage

  /**
   * @notice Constructor of the proxy, defining the implementation and the access manager
   * @dev Initializes the upgradeable proxy with an initial implementation specified by `implementation` and
   *      with `accessManager` as the ACCESS_MANAGER that will handle access control.
   *
   * @param implementation The initial implementation contract.
   * @param _data If nonempty, it's used as data in a delegate call to `implementation`. This will typically be an
   *              encoded function call, and allows initializing the storage of the proxy like a Solidity constructor.
   * @param accessManager The access manager that will handle access control
   * @param passThruMethods The selector of methods that will skip the access control validation, typically used for
   *                        views and other methods for gas optimization.
   *
   * @custom:pre If `_data` is empty, `msg.value` must be zero.
   */
  constructor(
    address implementation,
    bytes memory _data,
    IAccessManager accessManager,
    bytes4[] memory passThruMethods
  ) payable AccessManagedProxyBase(implementation, _data) {
    AMPUtils.setAccessManager(accessManager);
    AMPUtils.setPassThruMethods(passThruMethods);
  }

  /// @inheritdoc AccessManagedProxyBase
  function _skipAC(bytes4 selector) internal view override returns (bool) {
    return AMPUtils.getAccessManagedProxyStorage().skipAc[selector];
  }

  /// @inheritdoc IAccessManagedProxy
  // solhint-disable-next-line func-name-mixedcase
  function PASS_THRU_METHODS() external view override returns (bytes4[] memory methods) {
    return AMPUtils.getAccessManagedProxyStorage().passThruMethods;
  }

  /// @inheritdoc IAccessManagedProxy
  // solhint-disable-next-line func-name-mixedcase
  function ACCESS_MANAGER() public view override returns (IAccessManager) {
    return AMPUtils.getAccessManagedProxyStorage().accessManager;
  }
}
