/**
 * AI SDK v7: `rerank`
 *
 * `rerank` is a v7 core function that reorders a list of documents by their
 * relevance to a query. Ollama has no native rerank endpoint yet, so this
 * provider ships `ollama.embeddingReranking(...)`, a drop-in `RerankingModel`
 * that reranks via embedding cosine similarity.
 *
 * Run: pnpm --filter @examples/node exec tsx src/rerank-example.ts
 */
import { ollama } from 'ai-sdk-ollama';
import { rerank } from 'ai';
import { MODELS } from './model';

async function main() {
  console.log('=== rerank (v7) ===\n');

  const documents = [
    'The Eiffel Tower is located in Paris, France.',
    'Machine learning is a subset of AI that learns patterns from data.',
    'Bananas are a good source of potassium.',
    'Neural networks are a popular machine learning technique.',
    'The capital of Japan is Tokyo.',
  ];

  const { rerankedDocuments, ranking } = await rerank({
    model: ollama.embeddingReranking(MODELS.NOMIC_EMBED_TEXT),
    query: 'What is machine learning?',
    documents,
    topN: 3,
  });

  console.log('Query: "What is machine learning?"\n');
  console.log('Top 3 documents by relevance:');
  for (const [position, entry] of ranking.entries()) {
    console.log(
      `  ${position + 1}. [score ${entry.score.toFixed(4)}] ${entry.document}`,
    );
  }

  console.log(`\nrerankedDocuments[0]: ${rerankedDocuments[0]}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
