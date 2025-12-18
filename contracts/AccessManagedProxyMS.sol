// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";
import {AccessManagedProxyM} from "./AccessManagedProxyM.sol";

/**
 * @title AccessManagedProxyMS
 * @notice Specialization of AccessManagedProxyM with pass thru (skips AM) for some messages for gas optimization
 *
 * @custom:security-contact security@ensuro.co
 * @author Ensuro
 */
contract AccessManagedProxyMS is AccessManagedProxyM {
  /// @custom:storage-location erc7201:ensuro.storage.AccessManagedProxyMS
  struct AccessManagedProxyMSStorage {
    bytes4[] passThruMethods;
    mapping(bytes4 => bool) skipAc;
  }

  /**
   * @notice Storage slot with the address of the current access mananger.
   * @dev Computed as: `keccak256(
   *    abi.encode(uint256(keccak256("ensuro.storage.AccessManagedProxyMS")) - 1)
   * ) & ~bytes32(uint256(0xff))
   */
  // solhint-disable-next-line const-name-snakecase
  bytes32 internal constant AccessManagedProxyMSStorageLocation =
    0x2c1649c08e6705e35d0e3e89871b1c15613bd00d2a5b7ac8b68b4ee805002700;

  /**
   * @notice Constructor of the proxy, defining the implementation and the access manager
   * @dev Initializes the upgradeable proxy with an initial implementation specified by `implementation` and
   *      with `manager` as the ACCESS_MANAGER that will handle access control.
   *
   * @param implementation The initial implementation contract.
   * @param _data If nonempty, it's used as data in a delegate call to `implementation`. This will typically be an
   *              encoded function call, and allows initializing the storage of the proxy like a Solidity constructor.
   * @param manager The access manager that will handle access control
   * @param passThruMethods The selector of methods that will skip the access control validation, typically used for
   *                        views and other methods for gas optimization.
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
  ) payable AccessManagedProxyM(implementation, _data, manager) {
    AccessManagedProxyMSStorage storage $ = _getAccessManagedProxyMSStorage();
    $.passThruMethods = new bytes4[](passThruMethods.length);
    for (uint256 i; i < passThruMethods.length; ++i) {
      $.passThruMethods[i] = passThruMethods[i];
      $.skipAc[passThruMethods[i]] = true;
    }
  }

  function _getAccessManagedProxyMSStorage() internal pure returns (AccessManagedProxyMSStorage storage $) {
    // solhint-disable-next-line no-inline-assembly
    assembly {
      $.slot := AccessManagedProxyMSStorageLocation
    }
  }

  /*
   * @notice Skips the access control if the method called is one of the passThruMethods
   * @dev See {PASS_THRU_METHODS()}
   * @param selector The selector of the method called
   * @return Whether the access control using ACCESS_MANAGER should be skipped or not
   */
  function _skipAC(bytes4 selector) internal view override returns (bool) {
    return _getAccessManagedProxyMSStorage().skipAc[selector];
  }

  /**
   * @notice Gives observability to the methods that are skipped from access control
   * @dev This list is fixed and defined on contract construction
   * @return methods The list of method selectors that skip ACCESS_MANAGER access control
   */
  // solhint-disable-next-line func-name-mixedcase
  function PASS_THRU_METHODS() external view returns (bytes4[] memory methods) {
    return _getAccessManagedProxyMSStorage().passThruMethods;
  }
}
