import { Plugin } from 'vite';
import { createOllama } from 'ai-sdk-ollama';
import { streamText, convertToModelMessages } from 'ai';

export function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        try {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            try {
              const { messages, model = 'llama3.2:latest' } = JSON.parse(body);

              if (!messages || !Array.isArray(messages)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid messages format' }));
                return;
              }

              // Create Ollama provider
              const ollama = createOllama({
                baseURL: 'http://localhost:11434',
              });

              const result = await streamText({
                model: ollama(model),
                messages: convertToModelMessages(messages),
                system: 'You are a helpful assistant that can answer questions and help with tasks.',
              });

              // Use toUIMessageStreamResponse like in the chatbot example
              const response = result.toUIMessageStreamResponse();
              
              // Forward the response headers and body
              res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
              
              if (response.body) {
                const reader = response.body.getReader();
                const pump = async () => {
                  const { done, value } = await reader.read();
                  if (done) {
                    res.end();
                    return;
                  }
                  res.write(value);
                  pump();
                };
                pump();
              } else {
                res.end();
              }
            } catch (error) {
              console.error('Chat API error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        } catch (error) {
          console.error('API middleware error:', error);
          next();
        }
      });
    },
  };
}
