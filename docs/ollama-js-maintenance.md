# Ollama JavaScript dependency maintenance

`ai-sdk-ollama` uses only four operations from the Ollama JavaScript client:
`chat`, `embed`, `webSearch`, and `webFetch`. These operations are represented
by the exported structural `OllamaClient` interface. The official client, the
maintained fork, or a custom adapter can satisfy that interface.

## Maintained fork

- Upstream mirror: [`jagreehal/ollama-js` `main`](https://github.com/jagreehal/ollama-js/tree/main)
- Release branch: [`maintained-v0.6.4`](https://github.com/jagreehal/ollama-js/tree/maintained-v0.6.4)
- Package name: `@jagreehal/ollama`
- Package status: prepared but not yet published
- Draft release: `v0.6.4-maintained.0`

The release branch currently includes:

- upstream `main` after `v0.6.3`;
- optional completion-only streaming response fields;
- the correct `max_results` web-search wire field;
- per-request cancellation for chat, generate, embed, web search, and web
  fetch.

The fork verifies the web-search request body, including the exact
`max_results` wire key, in `test/browser.test.ts`.

## Publishing the first prerelease

1. Configure npm trusted publishing for `@jagreehal/ollama` and the GitHub
   `publish` workflow, or add `NODE_AUTH_TOKEN` to the fork's `release`
   environment.
2. Publish the prepared `v0.6.4-maintained.0` draft release. The release
   workflow derives the package version from that tag and publishes it under
   npm's `next` tag with provenance.
3. Verify the registry artifact:

   ```shell
   npm view @jagreehal/ollama@0.6.4-maintained.0
   ```

4. Pin this package to the exact release:

   ```json
   {
     "dependencies": {
       "ollama": "npm:@jagreehal/ollama@0.6.4-maintained.0"
     }
   }
   ```

5. Run the package quality checks and browser export tests before releasing
   `ai-sdk-ollama`.

Do not use a GitHub branch as the production dependency: the repository does
not commit build output, so a registry artifact is required for reliable
installation.
