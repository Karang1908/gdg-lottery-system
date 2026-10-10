# Contributing Guide

Thank you for contributing to the GDG Persistent Lottery System!

## Development Workflow
1. Clone the repository and install dependencies with `npm install`.
2. Run local development server with `npm run dev`.
3. Verify changes before committing using `npm run verify`.

## Commit Message Conventions
Commits must adhere to Conventional Commits format:
- `feat(scope)`: New features or capabilities
- `fix(scope)`: Bug fixes
- `docs(scope)`: Documentation additions or refinements
- `test(scope)`: Unit or integration test coverage
- `refactor(scope)`: Code changes neither fixing bugs nor adding features
- `chore(scope)`: Build tooling, dependency, or configuration updates

## Pull Request Checklist
Before submitting a PR:
- [ ] Run `npm run check` to confirm syntax passes without errors.
- [ ] Run `npm test` to ensure all unit and integration tests pass.
- [ ] Add new test cases for any new functionality or bug fixes.
- [ ] Verify that `npm run build` successfully produces minified assets.
