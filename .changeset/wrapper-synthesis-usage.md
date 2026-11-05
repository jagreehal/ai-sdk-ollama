---
'ai-sdk-ollama': patch
---

`generateText` and `streamText` keep the AI SDK's generics, so tool-specific options such as `experimental_toolCallers` type-check and `output` takes its type from your `Output`.

`usage` and `totalUsage` include synthesis and structured-output follow-up calls. In `streamText`, so do `text`, the `finish` part and `onEnd`/`onFinish`, and synthesis runs once, when you read the answer. `toUIMessageStream` and `toUIMessageStreamResponse` carry the answer, so `useChat` shows it.

With the default `stopWhen`, `toolChoice: 'required'` or a named tool applies to the first step and later steps use `auto`. Synthesis prompts carry each tool's input and output.

Decision models report a clear error for box questions and for questions without instructions.

`enableToolLogging` and `synthesisTimeout` are deprecated.
