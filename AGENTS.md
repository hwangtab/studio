# Repository Guidelines

## Project Structure & Module Organization
React client code lives in `src/`, with reusable UI in `src/components/`, route-level views in `src/pages/`, shared helpers in `src/utils/`, and Jest setup in `src/setupTests.js`. Markdown source for the Stories section sits in `content/stories/`; it is parsed by the automation in `scripts/generateStories.js`. Static assets (favicons, robots.txt, etc.) belong in `public/`, while production bundles are emitted to `build/` and inherit the custom `CNAME`. Node automation lives under `scripts/`, and the lightweight Express/LowDB companion API runs from `server/` (useful for local booking prototypes). Design notes and reference docs are kept in `docs/`.

## Build, Test, and Development Commands
Use `npm start` for the React dev server with live reload and lint overlay. `npm run build` performs a production build after pre-generating stories and the sitemap; verify the `build/` output before deploying. `npm test` launches Jest in watch mode—append `-- --watchAll=false` in CI. Content authors can regenerate static story JSON without a full build via `npm run generate-stories`. When deploying to GitHub Pages, `npm run deploy` publishes the latest build.

## Coding Style & Naming Conventions
Follow the CRA ESLint defaults; the linter runs automatically during `start` and `build`. Use 2-space indentation, `PascalCase` for React components and page files, and `camelCase` for hooks, helpers, and state setters. Tailwind utility classes are the preferred approach for layout tweaks; align new tokens with `tailwind.config.js`. Co-locate feature styles with their component when CSS modules are required, and keep public route names kebab-cased (e.g., `/practice-room`).

## Testing Guidelines
Jest with Testing Library powers existing suites (see `src/App.test.js` for patterns). Name new tests `*.test.js` beside the module under test. Aim for coverage of navigation flows, i18n copy, and Story detail rendering. Before opening a PR, run `npm test -- --watchAll=false` and `npm run build` to catch integration issues across generated content and Tailwind classes.

## Commit & Pull Request Guidelines
Commits follow a concise, sentence-style summary with an optional scope prefix (e.g., `Footer spacing: restore baseline gaps`). Keep bodies brief and explain intent over implementation details. Each PR should describe the user-facing impact, link to any tracking issue, and include screenshots or recordings for UI changes. Confirm that generated artifacts (stories, sitemap, CNAME) are up to date, note any skipped tests, and call out follow-up work so reviewers can respond quickly.***
