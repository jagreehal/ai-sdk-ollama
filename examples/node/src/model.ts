import { ollama } from "ai-sdk-ollama";

export const MODELS = {
  // Local models
  GPT_OSS_20B: 'gpt-oss:20b',
  LLAMA_3_2: 'llama3.2',
  PHI4_MINI: 'phi4-mini',
  QWEN_2_5_CODER: 'qwen2.5-coder:latest',
  NOMIC_EMBED_TEXT: 'nomic-embed-text',
  DEEPSEEK_R1_7B: 'deepseek-r1:7b',

  // Cloud models (recommended for web search)
  GPT_OSS_120B_CLOUD: 'gpt-oss:120b-cloud',
  QWEN3_480B_CLOUD: 'qwen3-coder:480b-cloud',
  DEEPSEEK_V3_1_CLOUD: 'deepseek-v3.1-cloud',
} as const;
  

export const MODEL = MODELS.GPT_OSS_20B;
export const model = ollama(MODELS.LLAMA_3_2);