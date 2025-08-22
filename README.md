# AccessManagedProxy

This repository contains the smart contract AccessManagedProxy, a proxy with built-in access control, delegating the
permissions to an OpenZeppelin's 5.x AccessManager.

## 🧐 Motivation

OZ 5.x introduces the AccessManager contract and AccessManaged base contract to move the access control decisions
from code to configuration. This is a step forward compared to the 4.x AccessControl authorization framework, where
you had to make decisions in the contract mapping methods to role names.

But the AccessManaged approach falls short, because you still have to make the decision (at coding time) of which
methods to decorate with the restricted modifier.

Implementing the access control with a modifier in the methods affects the observability of the access control
configuration and its formal verification.

It also increases the test effort and makes it harder to achieve 100% branch coverage in the contracts. Finally,
this has an effect on the contract size of the implementation contracts.

The widespread use of proxy contracts (mainly for upgradeable contracts) gives us the opportunity to move the
implementation of the access control delegation logic to the AccessManager contract (that is, in the end, what the
restricted modifier does) to the proxy contract.

In this way, BEFORE doing the delegatecall to the implementation contract, we will check if the call is enabled by
calling ACCESS_MANAGER.canCall(msg.sender, address(this), selector).

For gas-optimization or other reasons, we can define a list of methods (probably the views) that will be excluded
from calling the AccessManager, reducing the overhead for non-restricted method calls to the minimum.

Another advantage of this approach is the run-time observability of the access control configuration, by checking if
a given method is included in those that skip the access control, or otherwise, we will check the access manager
configuration for that method.

More details on the motivation of this idea here: https://forum.openzeppelin.com/t/accessmanagedproxy-is-a-good-idea/41917

## 📝 Details

The package includes the AccessManagedProxy contract, and AccessManagedProxyS1 to AccessManagedProxyS24 that are
versions that accept from 1 to 24 methods (selectors) that will be skipped of the access manager check, to reduce gas
usage or to access immutability on some methods.

## Development

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
```
