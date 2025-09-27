import './src/globals.css';
import { createOllama } from 'ai-sdk-ollama';
import { generateText, streamText } from 'ai';

// Types
interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaListResponse {
  models: OllamaModel[];
}

// DOM elements
const statusEl = document.getElementById('status') as HTMLDivElement;
const ollamaUrlEl = document.getElementById('ollamaUrl') as HTMLInputElement;
const modelEl = document.getElementById('model') as HTMLSelectElement;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const responseEl = document.getElementById('response') as HTMLDivElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const streamBtn = document.getElementById('streamBtn') as HTMLButtonElement;
const uiStreamBtn = document.getElementById('uiStreamBtn') as HTMLButtonElement;
const refreshModelsBtn = document.getElementById('refreshModelsBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;

// Initialize Ollama provider
let ollamaProvider: ReturnType<typeof createOllama>;

function updateStatus(message: string, type: 'info' | 'connected' | 'error' = 'info'): void {
  const statusDot = statusEl.querySelector('.status-dot') as HTMLElement;
  const statusText = statusEl.querySelector('span:last-child') as HTMLElement;
  
  if (statusDot && statusText) {
    statusText.textContent = message;
    statusDot.className = `status-dot w-2 h-2 rounded-full flex-shrink-0 ${
      type === 'connected' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 'bg-yellow-500'
    }`;
  }
}

function formatSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

async function loadAvailableModels(): Promise<void> {
  try {
    const baseURL = ollamaUrlEl.value;
    updateStatus('Loading available models...', 'info');
    
    // Use proxy for CORS-free requests in development, direct URL otherwise
    const apiUrl = window.location.hostname === 'localhost' ? '/api/tags' : `${baseURL}/api/tags`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    
    const data: OllamaListResponse = await response.json();
    
    // Clear existing options
    const currentValue = modelEl.value;
    modelEl.innerHTML = '<option value="">Select a model...</option>';
    
    // Add available models to dropdown
    data.models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = `${model.name} (${formatSize(model.size)})`;
      modelEl.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    const optionExists = Array.from(modelEl.options).some(option => option.value === currentValue);
    if (optionExists && currentValue) {
      modelEl.value = currentValue;
    } else if (data.models.length > 0) {
      // Prefer local models over cloud models for default selection
      const localModels = data.models.filter(model => !model.name.includes('-cloud'));
      const preferredModel = localModels.length > 0 ? localModels[0] : data.models[0];
      modelEl.value = preferredModel.name;
    }
    
    updateStatus(`Found ${data.models.length} available models`, 'connected');
  } catch (error) {
    console.error('Failed to load models:', error);
    updateStatus(`Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    
    // Add fallback common models (prioritize local models)
    modelEl.innerHTML = `
      <option value="">Select a model...</option>
      <option value="llama3.2:latest">llama3.2:latest (Recommended)</option>
      <option value="llama3.2:3b">llama3.2:3b (Fast)</option>
      <option value="phi4-mini:latest">phi4-mini:latest (Alternative)</option>
    `;
    // Set default to first local model
    modelEl.value = 'llama3.2:latest';
  }
}

function createOllamaProvider(): ReturnType<typeof createOllama> {
  const baseURL = ollamaUrlEl.value;
  const config: any = {
    baseURL: window.location.hostname === 'localhost' ? 'http://localhost:11434' : baseURL,
  };
  
  // Add API key for cloud models if available
  const apiKey = (window as any).OLLAMA_API_KEY;
  if (apiKey) {
    config.apiKey = apiKey;
  }
  
  return createOllama(config);
}

async function handleGenerate(): Promise<void> {
  const prompt = promptEl.value.trim();
  const model = modelEl.value;
  
  if (!prompt) {
    updateStatus('Please enter a prompt', 'error');
    return;
  }
  
  if (!model) {
    updateStatus('Please select a model', 'error');
    return;
  }
  
  try {
    updateStatus('Generating response...', 'info');
    responseEl.textContent = '';
    
    ollamaProvider = createOllamaProvider();
    
    const result = await generateText({
      model: ollamaProvider(model),
      prompt,
    });
    
    responseEl.textContent = result.text;
    updateStatus('Response generated successfully', 'connected');
  } catch (error) {
    console.error('Generation failed:', error);
    responseEl.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    updateStatus('Generation failed', 'error');
  }
}

async function handleStream(): Promise<void> {
  const prompt = promptEl.value.trim();
  const model = modelEl.value;
  
  if (!prompt) {
    updateStatus('Please enter a prompt', 'error');
    return;
  }
  
  if (!model) {
    updateStatus('Please select a model', 'error');
    return;
  }
  
  try {
    updateStatus('Streaming response...', 'info');
    responseEl.textContent = '';
    
    ollamaProvider = createOllamaProvider();
    
    const result = await streamText({
      model: ollamaProvider(model),
      prompt,
    });
    
    for await (const delta of result.textStream) {
      responseEl.textContent += delta;
    }
    
    updateStatus('Streaming completed', 'connected');
  } catch (error) {
    console.error('Streaming failed:', error);
    responseEl.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    updateStatus('Streaming failed', 'error');
  }
}

async function handleUIStream(): Promise<void> {
  const prompt = promptEl.value.trim();
  const model = modelEl.value;
  
  if (!prompt) {
    updateStatus('Please enter a prompt', 'error');
    return;
  }
  
  if (!model) {
    updateStatus('Please select a model', 'error');
    return;
  }
  
  try {
    updateStatus('UI Streaming response...', 'info');
    responseEl.textContent = '';
    
    ollamaProvider = createOllamaProvider();
    
    const result = await streamText({
      model: ollamaProvider(model),
      prompt,
    });
    
    // Use regular streaming for now (simpler implementation)
    for await (const delta of result.textStream) {
      responseEl.textContent += delta;
    }
    
    updateStatus('UI Streaming completed', 'connected');
  } catch (error) {
    console.error('UI Streaming failed:', error);
    responseEl.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    updateStatus('UI Streaming failed', 'error');
  }
}

function handleClear(): void {
  promptEl.value = '';
  responseEl.textContent = '';
  updateStatus('Cleared', 'info');
}

function handleCopy(): void {
  const responseText = responseEl.textContent;
  if (responseText) {
    navigator.clipboard.writeText(responseText).then(() => {
      updateStatus('Response copied to clipboard', 'connected');
      setTimeout(() => {
        updateStatus('Ready', 'connected');
      }, 2000);
    }).catch((error) => {
      console.error('Failed to copy:', error);
      updateStatus('Failed to copy response', 'error');
    });
  }
}

// Event listeners
generateBtn.addEventListener('click', handleGenerate);
streamBtn.addEventListener('click', handleStream);
uiStreamBtn.addEventListener('click', handleUIStream);
refreshModelsBtn.addEventListener('click', loadAvailableModels);
clearBtn.addEventListener('click', handleClear);
copyBtn.addEventListener('click', handleCopy);

// Handle Ctrl+Enter in textarea
promptEl.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault();
    handleGenerate();
  }
});

// Handle URL changes
ollamaUrlEl.addEventListener('change', () => {
  loadAvailableModels();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateStatus('Initializing...', 'info');
  loadAvailableModels();
});