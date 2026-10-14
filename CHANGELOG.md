# Changelog

All notable changes to the GDG Persistent Lottery System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-14
### Added
- Persistent lottery engine with Upstash Redis and local JSON state storage.
- Interactive HTML5 Canvas spinning wheel with physics-based deceleration.
- Mobile-first responsive registration page for audience entrants.
- Administrative console with live entrant roster and draw controls.
- Real-time countdown timer synchronized across all connected displays.
- Content-hashed static asset production bundler powered by esbuild.

### Testing & Verification
- Unit test suite covering domain validations, entrant sanitization, and state normalization.
- HTTP integration tests verifying Express API routing, headers, and error handling.
- Concurrency test simulating 175 simultaneous entrant registrations.

### Documentation
- Added system architecture specifications in `ARCHITECTURE.md`.
- Added security policies and threat model in `SECURITY.md`.
- Added developer contribution guide in `CONTRIBUTING.md`.
- Added complete REST API reference in `API.md`.
- Added deployment instructions in `DEPLOYMENT.md`.
