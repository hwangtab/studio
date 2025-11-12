# Repository Guidelines

## Project Structure & Module Organization
Client React code lives in `src/`, where `src/components/` hosts reusable UI, `src/pages/` maps to routes, and `src/utils/` stores shared helpers. Persist Jest setup tweaks in `src/setupTests.js`. Markdown sources for the Stories section sit under `content/stories/` and are transformed into JSON via `scripts/generateStories.js`. Static assets (favicons, CNAME, robots.txt) belong in `public/`, while production bundles land in `build/`. Automation scripts reside in `scripts/`, the lightweight Express/LowDB prototype API runs from `server/`, and design notes live in `docs/`.

## Build, Test, and Development Commands
Use `npm start` for the CRA dev server with Tailwind/Jest lint overlays. `npm run generate-stories` refreshes the static story JSON without rebuilding UI bundles. `npm test` launches Jest in watch mode; pass `npm test -- --watchAll=false` for CI parity. Ship builds with `npm run build`, which also pre-generates stories and the sitemap; confirm the resulting `build/` directory before deployment. Publish to GitHub Pages using `npm run deploy`.

## Coding Style & Naming Conventions
Follow CRA’s ESLint defaults with 2-space indentation. Name React components and route files in `PascalCase`, hooks/helpers/state setters in `camelCase`, and public URLs in kebab-case (e.g., `/practice-room`). Favor Tailwind utility classes for layout adjustments; extend tokens through `tailwind.config.js`. When CSS modules are essential, co-locate them with the component. Keep Markdown and automation scripts in plain ASCII to match repo norms.

## Testing Guidelines
Jest with Testing Library powers suites such as `src/App.test.js`. Co-locate tests as `*.test.js` beside the module they cover, exercising navigation flows, i18n copy, and Story detail rendering. Run `npm test -- --watchAll=false` plus `npm run build` before opening a PR to catch integration regressions tied to generated content.

## Commit & Pull Request Guidelines
Write succinct, sentence-style commit subjects, optionally adding a scope (e.g., `Footer spacing: restore baseline gaps`). PRs must describe the user-visible impact, link tracking issues, and attach screenshots or recordings for UI changes. Confirm that generated artifacts (Stories JSON, sitemap, CNAME) are current, call out any skipped tests, and note follow-up work so reviewers can respond quickly.
