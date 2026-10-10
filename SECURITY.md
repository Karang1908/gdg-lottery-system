# Security Policy

## Reporting Security Issues
If you discover a security vulnerability within the GDG Persistent Lottery System, please report it privately to the maintainers rather than opening a public issue.

## Threat Model
The system is designed for live presentation settings where the operator display is exposed to an audience, while entrant phones connect over shared event Wi-Fi.

## Timing-Attack Defenses
The administrative console requires an `ADMIN_PASSWORD`. Verification uses `crypto.timingSafeEqual` across identical buffer lengths to prevent timing attacks from leaking password length or characters via execution latency.

## HTTP Header Hardening
- `x-powered-by` is explicitly disabled on Express to reduce server fingerprinting.
- All dynamic API endpoints set `Cache-Control: private, no-store, max-age=0` to prevent intermediate proxies or shared browser caches from storing entrant data.
- Static assets in `dist/` are served with immutable caching using sha256 content hashes.
