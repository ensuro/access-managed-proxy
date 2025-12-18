// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";

/**
 * @title AccessManagedProxyBase
 * @notice Proxy contract using IAccessManager to manage access control before delegating calls.
 * @dev It's a variant of ERC1967Proxy.
 *
 *      Currently the check is executed on any call received by the proxy contract even calls to view methods
 *      (staticcall). In the setup of the ACCESS_MANAGER permissions you would want to make all the views and pure
 *      functions enabled for the PUBLIC_ROLE.
 *
 *      This base contract delegates on descendent contracts the storage of the ACCESS_MANAGER.
 *
 *      Check https://forum.openzeppelin.com/t/accessmanagedproxy-is-a-good-idea/41917 for a discussion on the
 *      advantages and disadvantages of using it.
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
abstract contract AccessManagedProxyBase is ERC1967Proxy {
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
   *
   * Requirements:
   *
   * - If `data` is empty, `msg.value` must be zero.
   */
  constructor(address implementation, bytes memory _data) payable ERC1967Proxy(implementation, _data) {}

  /**
   * @notice AccessManager contract that handles the permissions to access the implementation methods
   */
  // solhint-disable-next-line func-name-mixedcase
  function ACCESS_MANAGER() public view virtual returns (IAccessManager);

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
    bool immediate = _skipAC(selector); // reuse immediate variable both for skipped methods and canCall result
    if (!immediate) {
      (immediate, ) = ACCESS_MANAGER().canCall(msg.sender, address(this), selector);
      if (!immediate) revert AccessManagedUnauthorized(msg.sender);
    }
    super._delegate(implementation);
  }

  /**
   * @notice Returns whether to skip the access control validation or not
   * @dev Hook called before ACCESS_MANAGER.canCall to enable skipping the call to the access manager for performance
   *      reasons (for example on views) or to remove access control for other specific cases
   * @param selector The selector of the method called
   * @return Whether the access control using ACCESS_MANAGER should be skipped or not
   */
  // solhint-disable-next-line no-unused-vars
  function _skipAC(bytes4 selector) internal view virtual returns (bool) {
    return false;
  }
}
