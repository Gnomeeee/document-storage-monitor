# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains two empty directories: `backend/` and `frontend/`. No application code, tests, assets, or dependency manifests are present yet.

- Place server-side code and service configuration in `backend/`.
- Place client-side code and UI assets in `frontend/`.
- Keep tests near the code they exercise or in a clearly documented test directory within the relevant component.
- Document new entry points and directory conventions when introducing the initial implementation.

## Build, Test, and Development Commands

No build, development, or test commands are configured. Do not assume commands such as `npm install`, `npm test`, or `npm run build` are available.

When adding a toolchain, document exact setup, local development, build, lint, and test commands in the relevant component's README. Include required runtime versions and execute commands from the directory containing their configuration.

## Coding Style & Naming Conventions

No language, formatter, or linter has been selected. Establish these conventions alongside the first source files, using language-appropriate defaults. Keep indentation and naming consistent within each component. Prefer descriptive module and function names, and avoid unrelated formatting changes.

## Testing Guidelines

No testing framework or coverage threshold exists yet. Add appropriate test tooling with the first functional implementation. Document test filename patterns and execution commands. Cover expected behavior, validation failures, and relevant edge cases; add regression tests for bug fixes.

## Commit & Pull Request Guidelines

Git metadata is absent from this workspace, so no existing commit convention can be verified. Use concise, imperative commit subjects, such as `Add document upload validation`.

Pull requests should explain the change, include verification results, link relevant issues, and provide screenshots for visible UI changes. Explicitly state any checks that could not be run.

## Security & Configuration

Keep credentials and private documents out of source control. Provide configuration examples with placeholder values and document required environment variables when configuration is introduced.
