import { Ollama } from 'ollama';

async function testDirectOllamaToolCalls() {
  console.log('🔬 Testing direct Ollama tool calling API');
  console.log('='.repeat(50));

  const ollama = new Ollama({ host: 'http://localhost:11434' });

  try {
    console.log('1. Testing gpt-oss:20b with tools...');

    const response = await ollama.chat({
      model: 'gpt-oss:20b',
      messages: [
        {
          role: 'user',
          content: 'What is the weather in San Francisco? Use the weather tool.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'getWeather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'City name',
                },
              },
              required: ['city'],
            },
          },
        },
      ],
    });

    console.log('   Response:', response.message);
    console.log('   Tool calls:', response.message.tool_calls?.length || 0);

    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      for (const toolCall of response.message.tool_calls) {
        console.log('     -', toolCall);
      }
    }

    console.log('\n2. Testing llama3.2 with tools...');

    const llamaResponse = await ollama.chat({
      model: 'llama3.2',
      messages: [
        {
          role: 'user',
          content: 'What is the weather in San Francisco? Use the weather tool.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'getWeather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'City name',
                },
              },
              required: ['city'],
            },
          },
        },
      ],
    });

    console.log('   Response:', llamaResponse.message);
    console.log('   Tool calls:', llamaResponse.message.tool_calls?.length || 0);

    if (llamaResponse.message.tool_calls && llamaResponse.message.tool_calls.length > 0) {
      for (const toolCall of llamaResponse.message.tool_calls) {
        console.log('     -', toolCall);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

testDirectOllamaToolCalls().catch((error) => {
  console.error('Direct Ollama test failed:', error);
  process.exit(1);
});