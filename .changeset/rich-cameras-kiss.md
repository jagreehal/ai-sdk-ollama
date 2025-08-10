---
'ai-sdk-ollama': minor
---

Feature: Browser support and streaming improvements. Closes https://github.com/jagreehal/ai-sdk-ollama/issues/14

- feat(browser): Automatic browser support via `ollama/browser` with dedicated `index.browser` export. Works seamlessly with bundlers and `ai` v5 in browser contexts.
- fix(streaming): Emit trailing `text-delta` on the final `done` chunk to avoid empty streams for models that only flush content at the end. Note: streams may include one additional text chunk now.
- tests: Add `gpt-oss:20b` integration coverage and make prompts/token limits more robust; update unit tests to reflect final text emission on `done`.
- docs/examples: Switch Node examples to per-file `tsx` execution and update READMEs; clarify how to run browser and node examples.
- chore(repo): Monorepo migration (no user-facing API changes), Dependabot config for package folder, and CI refinements.

No breaking changes to the public API.
