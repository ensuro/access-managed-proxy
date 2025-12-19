// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";

/**
 * @title IAccessManagedProxy - Interface of AccessManagedProxy contracts
 * @notice This interface gives observability of the access control setup
 *
 * @dev The `ACCESS_MANAGER()` is the AccessManager contract that stores the access roles for most of the methods,
 * except those listed in `PASS_THRU_METHODS()` that are forwarded directly to the proxy and don't have access control
 * (at least not by the AccessManager contract).
 *
 * @author Ensuro
 */
interface IAccessManagedProxy {
  /**
   * @notice The ACCESS_MANAGER that manages the access controls was updated
   * @dev Authority that manages this contract was updated. Uses same interface as OZ's IAccessManaged
   */
  // solhint-disable-next-line gas-indexed-events
  event AuthorityUpdated(address authority);

  /**
   * @dev Emitted when the passThruMethods has changed.
   */
  event PassThruMethodsChanged(bytes4[] newPassThruMethods);

  // Errors copied from OZ's IAccessManaged
  error AccessManagedUnauthorized(address caller);
  error AccessManagedInvalidAuthority(address authority);

  /**
   * @notice Returns the current authority.
   * @dev Returns the current authority. Same as ACCESS_MANAGER(), added for compatibility with OZ's IAccessManaged
   */
  function authority() external view returns (address);

  /**
   * @notice AccessManager contract that handles the permissions to access the implementation methods
   */
  // solhint-disable-next-line func-name-mixedcase
  function ACCESS_MANAGER() external view returns (IAccessManager);

  /**
   * @notice Gives observability to the methods that are skipped from access control
   * @return methods The list of method selectors that skip ACCESS_MANAGER access control
   */
  // solhint-disable-next-line func-name-mixedcase
  function PASS_THRU_METHODS() external view returns (bytes4[] memory methods);
}
