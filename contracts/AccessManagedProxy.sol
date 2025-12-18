// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";
import {AccessManagedProxyBase} from "./AccessManagedProxyBase.sol";

/**
 * @title AccessManagedProxy
 * @notice Proxy contract using IAccessManager to manage access control before delegating calls (immutable version)
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
contract AccessManagedProxy is AccessManagedProxyBase {
  /**
   * @notice AccessManager contract that handles the permissions to access the implementation methods
   */
  IAccessManager internal immutable _accessManager;

  /**
   * @notice Constructor of the proxy, defining the implementation and the access manager
   * @dev Initializes the upgradeable proxy with an initial implementation specified by `implementation` and
   *      with `manager` as the ACCESS_MANAGER that will handle access control.
   *
   * @param implementation The initial implementation contract.
   * @param _data If nonempty, it's used as data in a delegate call to `implementation`. This will typically be an
   *              encoded function call, and allows initializing the storage of the proxy like a Solidity constructor.
   * @param manager The access manager that will handle access control
   *
   * @custom:pre If `data` is empty, `msg.value` must be zero.
   */
  constructor(
    address implementation,
    bytes memory _data,
    IAccessManager manager
  ) payable AccessManagedProxyBase(implementation, _data) {
    _accessManager = manager;
  }

  // solhint-disable-next-line func-name-mixedcase
  function ACCESS_MANAGER() public view override returns (IAccessManager) {
    return _accessManager;
  }
}
