# Security policy

## Supported versions

Before the first npm publication, security fixes are made on the default branch. After `0.1.0` is published, only the latest release is supported unless a release notice explicitly says otherwise. During the `0.x` series, minor versions may include breaking changes.

| Version                    | Security support                        |
| -------------------------- | --------------------------------------- |
| Latest `1.x`               | Supported after publication             |
| Older or prerelease builds | Upgrade to the latest supported release |

Security fixes may remove or change unsafe behavior without the usual deprecation window. Normal deprecations are announced in types, documentation, and the changelog and remain available until the next major release or for at least six months when practical.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability.

Use one of these private routes:

1. [GitHub private vulnerability reporting](https://github.com/amnesia2k/sendlib-sdk/security/advisories/new).
2. Email `tilewa.olatoyee@gmail.com` with the subject `@sendlib/node-sdk security report` if the GitHub route is unavailable.

Include the affected version, impact, reproduction steps, and a minimal sanitized proof of concept. Never include a real SendLib key, authorization header, personal recipient, production message, or sensitive attachment. If a credential was exposed, revoke it in SendLib immediately before contacting this project.

The maintainer will acknowledge reports when practical, investigate, coordinate a fix and disclosure timeline, and credit reporters who want attribution. Please allow a reasonable remediation period before public disclosure.

## Scope and boundaries

SDK credential exposure, unsafe logging, request manipulation, package compromise, and dependency vulnerabilities are in scope. SendLib account access, Gmail OAuth, upstream infrastructure, billing, and service vulnerabilities must be reported to SendLib through its official channels. This community project cannot access or repair SendLib systems.
