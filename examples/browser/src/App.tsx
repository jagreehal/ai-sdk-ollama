import { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { Message, MessageContent } from './components/ai-elements/message';
import { Response } from './components/ai-elements/response';
import { Conversation, ConversationContent } from './components/ai-elements/conversation';
import { PromptInput, PromptInputTextarea, PromptInputSubmit, PromptInputToolbar } from './components/ai-elements/prompt-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
}


interface OllamaListResponse {
  models: OllamaModel[];
}

function formatSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export default function App() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('Connecting to Ollama...');
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const { messages, sendMessage, status: chatStatus } = useChat();

  const [input, setInput] = useState('Write a simple hello world program in Python');
  const isLoading = chatStatus === 'streaming' || chatStatus === 'submitted';

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (_message: any, e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModel) return;
    
    sendMessage(
      { text: input },
      {
        body: {
          model: selectedModel,
        },
      }
    );
    setInput('');
  };

  // Load available models
  const loadModels = async () => {
    try {
      setIsLoadingModels(true);
      setConnectionStatus('Loading available models...');
      
      const apiUrl = window.location.hostname === 'localhost' ? '/api/tags' : `${ollamaUrl}/api/tags`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }
      
      const data: OllamaListResponse = await response.json();
      setModels(data.models);
      
      // Prefer local models over cloud models for default selection
      const localModels = data.models.filter(model => !model.name.includes('-cloud'));
      const preferredModel = localModels.length > 0 ? localModels[0] : data.models[0];
      setSelectedModel(preferredModel.name);
      
      setConnectionStatus(`Found ${data.models.length} available models`);
    } catch (error) {
      console.error('Failed to load models:', error);
      setConnectionStatus(`Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Add fallback models
      const fallbackModels = [
        { name: 'llama3.2:latest', model: 'llama3.2:latest', modified_at: '', size: 0, digest: '' },
        { name: 'llama3.2:3b', model: 'llama3.2:3b', modified_at: '', size: 0, digest: '' },
        { name: 'phi4-mini:latest', model: 'phi4-mini:latest', modified_at: '', size: 0, digest: '' },
      ];
      setModels(fallbackModels);
      setSelectedModel('llama3.2:latest');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load models on component mount
  useEffect(() => {
    loadModels();
  }, [ollamaUrl]);

  const handleClear = () => {
    // Clear messages by reloading the page or implementing a clear function
    window.location.reload();
  };

  const getStatusColor = () => {
    if (connectionStatus.includes('Found') && connectionStatus.includes('models')) return 'bg-green-500';
    if (connectionStatus.includes('Failed') || connectionStatus.includes('error')) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">AI SDK Ollama Browser Example</h1>
        <p className="text-muted-foreground mt-2">
          Interactive demo of Ollama integration with AI Elements
        </p>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor()}`}></div>
            <span className="text-sm font-medium">{connectionStatus}</span>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Panel */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="ollamaUrl" className="text-sm font-medium">Ollama URL</label>
              <Input
                id="ollamaUrl"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="model" className="text-sm font-medium">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full bg-background border-border hover:bg-accent/50 transition-colors">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-lg backdrop-blur-sm">
                  {models.map((model) => (
                    <SelectItem 
                      key={model.name} 
                      value={model.name}
                      className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                    >
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({formatSize(model.size)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadModels} disabled={isLoadingModels}>
              {isLoadingModels ? 'Loading...' : 'Refresh Models'}
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <div className="flex flex-col h-[600px] border rounded-lg">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts?.map((part, i) => {
                    if (part.type === 'text') {
                      return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                    }
                    return null;
                  }) || (
                    <Response>No content</Response>
                  )}
                </MessageContent>
              </Message>
            ))}
            {isLoading && (
              <Message from="assistant">
                <MessageContent>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Generating response...</span>
                  </div>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="border-t">
          <PromptInputTextarea
            value={input}
            onChange={handleInputChange}
            placeholder="Enter your message here... (Ctrl+Enter to send)"
          />
          <PromptInputToolbar>
            <PromptInputSubmit disabled={!input || !selectedModel} />
          </PromptInputToolbar>
        </PromptInput>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-border">
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Built with <a href="https://ai-sdk.dev" className="text-primary hover:underline">AI SDK</a> and 
            <a href="https://ollama.com" className="text-primary hover:underline">Ollama</a>
          </p>
          <p className="mt-1">
            Using <a href="https://ai-sdk.dev/elements" className="text-primary hover:underline">AI Elements</a> components
          </p>
        </div>
      </div>
    </div>
  );
}
