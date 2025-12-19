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

Also check https://www.youtube.com/watch?v=DKdwJ9Ap9vM for a presentation on this approach.

## 📝 Details

The AccessManagedProxy contract stores the configuration in the storage (uses namespaced storage layout, see EIP-7201),
but it doesn't include in the proxy functions to modify it. The implementation contracts should add the functions to
change the access manager (`setAuthority(...)`, following IAccessManaged interface of OZ 5.x) or the passThruMethods.

The AMPUtils library includes several functions to modify the custom storage and other operations like making custom
access control checks.

Also, an AccessManagedProxyBase abstract contract is provided in case you prefer to use immutable storage or other
variants.

## Development

Try running some of the following tasks:

```shell
REPORT_GAS=true npx hardhat test
npx hardhat coverage
```
