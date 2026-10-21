# OSS Scanner build image (https://github.com/anthropics/oss-scanner).
# Built online with the repository as context; the audit that follows runs offline,
# so everything the build and the unit tests need is installed here.
FROM node:24-bookworm

ENV CI=true \
    TURBO_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

RUN pnpm install --frozen-lockfile

# The published provider only. examples/ is out of scope; see threat_model.md.
RUN pnpm --filter ai-sdk-ollama build

# Unit tests prove the image works; a failure must not abort the build.
# Integration tests need a running Ollama server and are not run here.
RUN pnpm --filter ai-sdk-ollama test || echo "WARNING: unit tests reported failures"
