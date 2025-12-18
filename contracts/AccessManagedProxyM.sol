// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";
import {StorageSlot} from "@openzeppelin/contracts/utils/StorageSlot.sol";
import {AccessManagedProxyBase} from "./AccessManagedProxyBase.sol";

/**
 * @title AccessManagedProxyM
 * @notice Proxy contract using IAccessManager to manage access control before delegating calls (mutable version)
 * @dev It's a variant of ERC1967Proxy.
 *
 *      Currently the check is executed on any call received by the proxy contract even calls to view methods
 *      (staticcall). In the setup of the ACCESS_MANAGER permissions you would want to make all the views and pure
 *      functions enabled for the PUBLIC_ROLE.
 *
 *      The access manager can be changed by calling setAuthority
 *
 *      Check https://forum.openzeppelin.com/t/accessmanagedproxy-is-a-good-idea/41917 for a discussion on the
 *      advantages and disadvantages of using it.
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract AccessManagedProxyM is AccessManagedProxyBase {
  /**
   * @notice Storage slot with the address of the current access mananger.
   * @dev Computed as: `keccak256(
   *    abi.encode(uint256(keccak256("ensuro.storage.AccessManagedProxyM.ACCESS_MANAGER")) - 1)
   * ) & ~bytes32(uint256(0xff))
   */
  // solhint-disable-next-line const-name-snakecase
  bytes32 internal constant ACCESS_MANAGER_SLOT = 0x2518994648e4a29af35d5d1b4b15a541173b8fabed9d3f7e10411447417eb800;

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
    StorageSlot.getAddressSlot(ACCESS_MANAGER_SLOT).value = address(manager);
  }

  function ACCESS_MANAGER() public view override returns (IAccessManager) {
    return IAccessManager(StorageSlot.getAddressSlot(ACCESS_MANAGER_SLOT).value);
  }
}
