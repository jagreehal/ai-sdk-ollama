---
'ai-sdk-ollama': minor
---

Add `ollama.speech()` for Ollama text-to-speech models such as `phonon`, used with the AI SDK's `generateSpeech`.

- `OllamaSpeechModel` implements `SpeechModelV4` on `/v1/audio/speech`. It needs Ollama 0.40.9+ on Apple Silicon.
- `voice` defaults to `default` and `outputFormat` to `wav`, with `pcm` as the other choice.
- The model turns `speed`, `instructions`, `language` and other formats into warnings and keeps them out of the request.
- Ollama's error message reaches you as written, so an unknown voice lists the voices you can use.
