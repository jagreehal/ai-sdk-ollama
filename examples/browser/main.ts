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
const refreshModelsBtn = document.getElementById('refreshModelsBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;

// Initialize Ollama provider
let ollama: ReturnType<typeof createOllama>;

function updateStatus(message: string, type: 'info' | 'connected' | 'error' = 'info'): void {
  const statusDot = statusEl.querySelector('.status-dot') as HTMLElement;
  const statusText = statusEl.querySelector('span:last-child') as HTMLElement;
  
  if (statusDot && statusText) {
    statusText.textContent = message;
    statusDot.className = `status-dot ${type} flex-shrink-0`;
    
    // Add slide animation
    statusEl.classList.remove('animate-slide-down');
    statusEl.offsetHeight; // Trigger reflow
    statusEl.classList.add('animate-slide-down');
  }
}

async function loadAvailableModels(): Promise<void> {
  try {
    const baseURL = ollamaUrlEl.value;
    updateStatus('Loading available models...', 'info');
    
    // Use proxy for CORS-free requests in development, direct URL otherwise
    const apiUrl = window.location.hostname === 'localhost' ? '/api/tags' : `${baseURL}/api/tags`;
    
    // Fetch available models from Ollama API
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    
    const data: OllamaListResponse = await response.json();
    
    // Clear existing options except the first "loading" option
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
      // Select first available model if previous selection doesn't exist
      modelEl.value = data.models[0].name;
    }
    
    updateStatus(`Found ${data.models.length} available models`, 'connected');
  } catch (error) {
    console.error('Failed to load models:', error);
    updateStatus(`Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    
    // Add fallback common models
    modelEl.innerHTML = `
      <option value="">Select a model...</option>
      <option value="llama3.2">llama3.2</option>
      <option value="llama3.2:1b">llama3.2:1b</option>
      <option value="llama3.2:3b">llama3.2:3b</option>
      <option value="mistral">mistral</option>
      <option value="phi4">phi4</option>
      <option value="qwen2.5:0.5b">qwen2.5:0.5b</option>
      <option value="codellama">codellama</option>
    `;
  }
}

function formatSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

async function initializeOllama(): Promise<void> {
  try {
    const baseURL = ollamaUrlEl.value;
    
    // Use proxy for CORS-free requests in development, direct URL otherwise
    const proxyBaseURL = window.location.hostname === 'localhost' ? window.location.origin : baseURL;
    
    // Create Ollama provider with custom baseURL
    ollama = createOllama({
      baseURL: proxyBaseURL,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    updateStatus(`Connected to Ollama at ${baseURL}`, 'connected');
    console.log('Ollama provider initialized for browser');
    
    // Load available models
    await loadAvailableModels();
    
  } catch (error) {
    updateStatus(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    console.error('Initialization error:', error);
  }
}

async function handleGenerate(): Promise<void> {
  const prompt = promptEl.value.trim();
  const selectedModel = modelEl.value;
  
  if (!prompt) {
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-amber-400">Please enter a prompt</div>
    `;
    return;
  }
  
  if (!selectedModel) {
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-amber-400">Please select a model</div>
    `;
    return;
  }
  
  generateBtn.disabled = true;
  streamBtn.disabled = true;
  if (clearBtn) clearBtn.disabled = true;
  
  responseEl.innerHTML = `
    <div class="flex items-center gap-2 text-slate-400">
      <div class="flex space-x-1">
        <div class="w-2 h-2 bg-red-500 rounded-full"></div>
        <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
        <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      </div>
      <span class="text-xs">AI Response Terminal</span>
    </div>
    <div class="mt-4 flex items-center gap-2 text-indigo-400">
      <div class="loading"></div>
      <span>Generating response...</span>
    </div>
  `;
  
  try {
    const { text } = await generateText({
      model: ollama(selectedModel),
      prompt: prompt,
      temperature: 0.7,
      maxOutputTokens: 500,
    });
    
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-slate-300">${text.replace(/\n/g, '<br>')}</div>
    `;
    updateStatus('Generation complete', 'connected');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-red-400">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <strong>Error:</strong>
        </div>
        <div class="mt-1 ml-6">${errorMessage}</div>
      </div>
    `;
    updateStatus(`Generation failed: ${errorMessage}`, 'error');
    console.error('Generation error:', error);
  } finally {
    generateBtn.disabled = false;
    streamBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
  }
}

async function handleStream(): Promise<void> {
  const prompt = promptEl.value.trim();
  const selectedModel = modelEl.value;
  
  if (!prompt) {
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-amber-400">Please enter a prompt</div>
    `;
    return;
  }
  
  if (!selectedModel) {
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-amber-400">Please select a model</div>
    `;
    return;
  }
  
  generateBtn.disabled = true;
  streamBtn.disabled = true;
  if (clearBtn) clearBtn.disabled = true;
  
  responseEl.innerHTML = `
    <div class="flex items-center gap-2 text-slate-400">
      <div class="flex space-x-1">
        <div class="w-2 h-2 bg-red-500 rounded-full"></div>
        <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
        <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      </div>
      <span class="text-xs">AI Response Terminal</span>
    </div>
    <div class="mt-4 flex items-center gap-2 text-emerald-400">
      <div class="loading"></div>
      <span>Streaming response...</span>
    </div>
  `;
  
  let streamContent = '';
  
  try {
    const { textStream } = await streamText({
      model: ollama(selectedModel),
      prompt: prompt,
      temperature: 0.7,
      maxOutputTokens: 500,
    });
    
    updateStatus('Streaming...', 'connected');
    
    for await (const chunk of textStream) {
      streamContent += chunk;
      responseEl.innerHTML = `
        <div class="flex items-center gap-2 text-slate-400">
          <div class="flex space-x-1">
            <div class="w-2 h-2 bg-red-500 rounded-full"></div>
            <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
          <span class="text-xs">AI Response Terminal - Streaming...</span>
        </div>
        <div class="mt-4 text-slate-300">${streamContent.replace(/\n/g, '<br>')}<span class="animate-pulse">▊</span></div>
      `;
    }
    
    // Remove cursor after streaming is complete
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-slate-300">${streamContent.replace(/\n/g, '<br>')}</div>
    `;
    
    updateStatus('Stream complete', 'connected');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-red-400">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <strong>Stream Error:</strong>
        </div>
        <div class="mt-1 ml-6">${errorMessage}</div>
      </div>
    `;
    updateStatus(`Stream failed: ${errorMessage}`, 'error');
    console.error('Stream error:', error);
  } finally {
    generateBtn.disabled = false;
    streamBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
  }
}

// Clear response function
function handleClear(): void {
  responseEl.innerHTML = `
    <div class="flex items-center gap-2 text-slate-400">
      <div class="flex space-x-1">
        <div class="w-2 h-2 bg-red-500 rounded-full"></div>
        <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
        <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      </div>
      <span class="text-xs">AI Response Terminal</span>
    </div>
    <div class="mt-4 text-slate-300">
      Response will appear here...
    </div>
  `;
  updateStatus('Response cleared', 'info');
}

// Copy response function
function handleCopy(): void {
  const responseText = responseEl.textContent?.replace(/AI Response Terminal\s*/, '') || '';
  if (responseText.trim() && responseText !== 'Response will appear here...') {
    navigator.clipboard.writeText(responseText.trim()).then(() => {
      updateStatus('Response copied to clipboard', 'connected');
    }).catch(() => {
      updateStatus('Failed to copy response', 'error');
    });
  }
}

// Event listeners
generateBtn.addEventListener('click', handleGenerate);
streamBtn.addEventListener('click', handleStream);
refreshModelsBtn.addEventListener('click', loadAvailableModels);
if (clearBtn) clearBtn.addEventListener('click', handleClear);
if (copyBtn) copyBtn.addEventListener('click', handleCopy);

// Handle Enter key in prompt textarea (Ctrl+Enter or Cmd+Enter to generate)
promptEl.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleGenerate();
  }
});

// Auto-resize textarea
promptEl.addEventListener('input', () => {
  promptEl.style.height = 'auto';
  promptEl.style.height = Math.min(promptEl.scrollHeight, 200) + 'px';
});

// Re-initialize when URL changes
ollamaUrlEl.addEventListener('change', initializeOllama);

// Initialize clear state
handleClear();

// Add welcome message
setTimeout(() => {
  if (responseEl.textContent?.includes('Response will appear here...')) {
    responseEl.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <div class="flex space-x-1">
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <span class="text-xs">AI Response Terminal</span>
      </div>
      <div class="mt-4 text-slate-400 italic">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span class="text-indigo-400 font-medium">Welcome to AI SDK Ollama!</span>
        </div>
        <div class="text-sm leading-relaxed">
          • Enter your prompt above and click Generate or Stream<br>
          • Use <kbd class="px-1 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">Ctrl+Enter</kbd> (or <kbd class="px-1 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">⌘+Enter</kbd>) to generate from the text area<br>
          • Make sure your Ollama server is running with CORS enabled<br>
          • Select a model from the configuration above to get started
        </div>
      </div>
    `;
  }
}, 1000);

// Log that we're using the browser version
console.log('🚀 AI SDK Ollama Browser Example loaded');
console.log('📡 Using ollama/browser for browser compatibility');
console.log('💡 Press Ctrl+Enter (⌘+Enter on Mac) to generate from textarea');

// Initialize after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOllama);
} else {
  initializeOllama();
}