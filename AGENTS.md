# Repository Guidelines

## Project Structure & Module Organization
The Python extension logic lives in `__init__.py`, `routes.py`, `diff_manager.py`, `remap_manager.py`, and `batch_processor.py`. These coordinate with ComfyUI’s `PromptServer` to expose REST endpoints for diff/remap management. Persisted assets live under `data/`, with `data/evals/` organized into named evaluation folders, `data/diffs/` storing saved JSON diff snapshots, and `data/remaps/` for remap presets. The front-end source is in `web/src/` (TypeScript/ES modules); Vite outputs compiled assets to `web/js/` for ComfyUI to serve. Keep new code in these existing buckets so rsync in the Makefile continues to work.

## Build, Test, and Development Commands
`make build` compiles the Vite frontend (`npm run build` in `web/`).  
`make dev` rebuilds the UI, syncs the repo into a local `ComfyUI/custom_nodes/` checkout, and starts ComfyUI with CORS enabled.  
`make install` bootstraps a fresh ComfyUI clone, virtualenv, and editable install of this extension (heavyweight; use for first-time setup).  
When iterating on the web client only, `cd web && npm run build` is sufficient before reloading the ComfyUI browser tab.

## Coding Style & Naming Conventions
Follow the existing four-space indentation and type-hinted patterns in the Python modules, using `logging.getLogger(__name__)` for observability. Module and file names stay snake_case (`diff_manager.py`), while public classes use PascalCase. In `web/src/`, prefer TypeScript (`.ts`) with camelCase helpers and descriptive file names (`diffPopup.ts`). Avoid introducing framework-specific globals; rely on imports and Vite configuration (`vite.config.mts`).

## Testing Guidelines
There is no automated test harness yet. Before pushing changes, run `make build` (or `npm run build`) to ensure the bundle emits into `web/js/`. Launch `make dev` to exercise flows end-to-end: confirm routes in `/rebase/` respond, saved diffs appear under `data/diffs/`, and evaluation folders load images via `/rebase/data/view`. Document any manual scenarios in PR notes until pytest or frontend test scaffolding is established.

## Commit & Pull Request Guidelines
Commits follow short, imperative summaries (`factor replaceNodeValue`, `Add batch_processor script`). Break work into reviewable commits and mention affected modules when helpful. Pull requests should describe the user-facing impact, reference related issues or workflows, and attach before/after screenshots or GIFs for UI tweaks. Call out data migrations touching `data/` folders so reviewers can clean their local caches.
