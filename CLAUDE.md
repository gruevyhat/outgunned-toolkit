# Repository guidance

Read `docs/PLAN.md` before changing the web app. Never invent rule values: verify against the PDFs under the gitignored `books/` symlink and preserve `pageRef`. Keep `app/src/engine` pure, pass `rng` as the first argument to randomized functions, and run `npm test` plus `npm run build` from `app/` before handoff. Do not commit unless explicitly asked.
