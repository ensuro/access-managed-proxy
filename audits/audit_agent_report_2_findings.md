# Audit Agent Report #2 — Findings Response

This document records our stance on the findings in
[`audit_agent_report_2_763f50d3-3741-4440-9eef-5381d8e1ba0f.pdf`](./audit_agent_report_2_763f50d3-3741-4440-9eef-5381d8e1ba0f.pdf).

Report: Nethermind AuditAgent scan #2 (September 17, 2026), commit `80d7344c…4fd1ed1a`.
Findings: 2 Medium, 1 Low, 1 Info.

## Finding #1 — Acknowledged (Medium)

*An incompatible authority can permanently disable all non-pass-through proxy calls, including gated recovery paths.*

This is a deployment/configuration issue. `setAccessManager` can only verify that the new authority has code, and
no on-chain check can validate its behavior. The same class of risk exists for any upgradeable contract: an upgrade
can always be made that permanently bricks upgradeability. It must be handled at deployment/change time — authority
changes must be properly validated with a fork simulation before being applied to a live production proxy.

## Finding #2 — Acknowledged (Medium)

*Proxy mishandles delayed AccessManager operations, rejecting direct calls and substituting the AccessManager as
caller on relays.*

This is a design decision: delayed execution / timelocks are not supported by the proxy semantics, only standard
access controls (who can call what methods). A relayed call made through `AccessManager.execute` observing
`msg.sender == ACCESS_MANAGER` is standard OpenZeppelin `AccessManager` behavior, not a proxy-specific issue.
Implementations must not add their own internal access-control layer on top of AMP nor rely on the caller identity;
if they do, that is part of their own threat model. The authorization is still tied to the originally authorized
account, and the `transferFrom(msg.sender, …)` scenario additionally requires the AccessManager to hold funds and to
have approved the proxy.

## Finding #3 — Documented (Low)

*AMPUtils.setPassThruMethods overwrites the observability array without clearing the previous skipAc entries,
leaving invisible access-control bypasses.*

`setPassThruMethods` is additive: it marks the new selectors in `skipAc` but never clears the previous ones, so it
must not be used to update the pass-through configuration. Any implementation function that changes the pass-through
methods must use `replacePassThruMethods`, which clears the previous entries first. Pass-through methods must be
configured through the proxy constructor; implementation initializers must never set or replace them, because the
initializer runs before the constructor configures the pass-through list and its entries would silently remain
flagged in `skipAc`. We added documentation to the library and the README, and the example implementation
(`DummyImplementation`) uses `replacePassThruMethods`.

## Finding #4 — Rejected (Info)

*Synthetic and "fake" selectors share the AccessManager selector namespace without domain separation.*

Exploiting this would require a malicious (or grossly negligent) implementation contract using the proxy. A malicious
implementation already has arbitrary control of the proxy through `delegatecall`, so domain separation adds no
security — the attack is self-defeating. Synthetic selectors intentionally share the AccessManager namespace with
real function selectors; accidental collisions are possible but statistically negligible (1 in 2^32 per selector)
and cannot be forced by an attacker without control over the implementation.
