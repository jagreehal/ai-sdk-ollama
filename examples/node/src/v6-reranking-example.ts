/**
 * AI SDK v6 - Ollama Reranking Example (Embedding-Based)
 *
 * This example demonstrates real-world use cases for reranking with the AI SDK v6
 * using Ollama's embedding models to compute semantic similarity.
 *
 * Since Ollama doesn't have native reranking support yet (PR #11389 not merged),
 * we use `ollama.embeddingReranking()` which computes relevance scores using
 * cosine similarity between query and document embeddings.
 *
 * Prerequisites:
 * 1. Ollama running locally
 * 2. An embedding model pulled: ollama pull embeddinggemma
 *
 * Recommended embedding models for reranking (in order of quality):
 *   - embeddinggemma (best score separation for reranking)
 *   - bge-m3
 *   - nomic-embed-text
 */

import { rerank } from 'ai';
import { ollama } from 'ai-sdk-ollama';

// =============================================================================
// REALISTIC DATA: Customer Support Knowledge Base
// =============================================================================

const supportArticles = [
  {
    id: 'KB001',
    title: 'How to Reset Your Password',
    content: 'To reset your password, click "Forgot Password" on the login page. Enter your email address and we will send you a reset link. The link expires in 24 hours.',
  },
  {
    id: 'KB002',
    title: 'Billing and Payment Methods',
    content: 'We accept Visa, MasterCard, American Express, and PayPal. To update your payment method, go to Settings > Billing > Payment Methods. Invoices are sent on the 1st of each month.',
  },
  {
    id: 'KB003',
    title: 'Account Plan Changes',
    content: 'To cancel your subscription, navigate to Settings > Subscription > Cancel Plan. Your access will continue until the end of your billing period. Refunds are available within 14 days of purchase.',
  },
  {
    id: 'KB004',
    title: 'Two-Factor Authentication Setup',
    content: 'Enable 2FA for extra security. Go to Settings > Security > Two-Factor Auth. Scan the QR code with Google Authenticator or Authy. Save your backup codes in a safe place.',
  },
  {
    id: 'KB005',
    title: 'Exporting Your Data',
    content: 'You can export all your data at any time. Go to Settings > Privacy > Export Data. We will prepare a ZIP file with your information and email you when it is ready for download.',
  },
  {
    id: 'KB006',
    title: 'API Rate Limits',
    content: 'Free tier: 100 requests/hour. Pro tier: 10,000 requests/hour. Enterprise: unlimited. Rate limit headers are included in every response. Contact sales for custom limits.',
  },
];

// =============================================================================
// REALISTIC DATA: Email Inbox
// =============================================================================

const emailInbox = [
  {
    id: 1,
    from: 'aws-billing@amazon.com',
    subject: 'Your AWS Invoice for December 2024',
    preview: 'Your total charges for December 2024 are $847.32. View your detailed invoice in the AWS Billing Console.',
    date: '2024-12-15',
  },
  {
    id: 2,
    from: 'team@linear.app',
    subject: 'Weekly Project Update',
    preview: '12 issues completed, 5 in progress. Sprint velocity is up 15% from last week. View full report.',
    date: '2024-12-14',
  },
  {
    id: 3,
    from: 'noreply@github.com',
    subject: 'Security alert: new sign-in from Chrome on Mac',
    preview: 'We noticed a new sign-in to your account from Chrome on macOS. If this was you, no action is needed.',
    date: '2024-12-14',
  },
  {
    id: 4,
    from: 'sales@datadog.com',
    subject: 'Your Datadog Quote - Enterprise Plan',
    preview: 'Thank you for your interest in Datadog Enterprise. Your custom quote: $2,400/month for 50 hosts.',
    date: '2024-12-13',
  },
  {
    id: 5,
    from: 'no-reply@vercel.com',
    subject: 'Deployment failed: main branch',
    preview: 'Build failed for commit abc123. Error: Module not found. View build logs for details.',
    date: '2024-12-13',
  },
  {
    id: 6,
    from: 'hr@company.com',
    subject: 'Holiday Schedule Reminder',
    preview: 'The office will be closed Dec 25-26 and Jan 1. Please submit your PTO requests by Dec 20.',
    date: '2024-12-12',
  },
];

// =============================================================================
// REALISTIC DATA: Product Documentation (RAG use case)
// =============================================================================

const productDocs = [
  'The createClient() function initializes a new API client. Pass your API key as the first argument. Optional second argument is a config object with baseUrl and timeout settings.',
  'Authentication uses Bearer tokens. Include the header "Authorization: Bearer YOUR_API_KEY" in all requests. Tokens expire after 30 days and must be refreshed.',
  'Rate limiting returns HTTP 429 when exceeded. The response includes Retry-After header indicating seconds to wait. Implement exponential backoff for production use.',
  'Webhooks are sent via POST to your configured endpoint. Verify the X-Signature header using HMAC-SHA256 with your webhook secret. Events are retried 3 times on failure.',
  'Error responses follow RFC 7807 Problem Details format. The "type" field contains a URL to documentation. The "detail" field has a human-readable explanation.',
  'Pagination uses cursor-based navigation. Response includes "next_cursor" field. Pass this as the "cursor" query parameter to fetch the next page. Maximum 100 items per page.',
];

async function main() {
  console.log('AI SDK v6 - Ollama Reranking Example');
  console.log('====================================\n');

  // embeddinggemma has better score separation for reranking tasks
  const embeddingModel = 'embeddinggemma';

  console.log(`Embedding model: ${embeddingModel}`);
  console.log('Using embedding similarity for reranking (Ollama native reranking not yet available)\n');

  // =========================================================================
  // Example 1: Customer Support - Finding Relevant Help Articles
  // =========================================================================

  console.log('Example 1: Customer Support Knowledge Base Search');
  console.log('='.repeat(50));
  console.log('Scenario: User asks "How do I get a refund?"');
  console.log(`Searching ${supportArticles.length} knowledge base articles...\n`);

  try {
    const supportQuery = 'How do I get a refund?';

    const result1 = await rerank({
      model: ollama.embeddingReranking(embeddingModel),
      documents: supportArticles.map(a => `${a.title}: ${a.content}`),
      query: supportQuery,
      topN: 3,
    });

    console.log('Top 3 relevant articles:');
    result1.ranking.forEach((item, i) => {
      const article = supportArticles[item.originalIndex];
      console.log(`  ${i + 1}. [${item.score.toFixed(3)}] ${article.title}`);
      console.log(`     ${article.content.slice(0, 80)}...`);
    });

    // The cancellation article mentions refunds
    const topArticle = supportArticles[result1.ranking[0].originalIndex];
    const isRefundArticle = topArticle.content.toLowerCase().includes('refund');
    console.log(`\n  Refund info in top result: ${isRefundArticle ? 'YES' : 'NO'}`);
    console.log();
  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.log();
  }

  // =========================================================================
  // Example 2: Email Search - Finding Specific Emails
  // =========================================================================

  console.log('Example 2: Email Inbox Search');
  console.log('='.repeat(50));
  console.log('Scenario: "Find the pricing quote from Datadog"');
  console.log(`Searching ${emailInbox.length} emails...\n`);

  try {
    const emailQuery = 'Find the pricing quote from Datadog';

    const result2 = await rerank({
      model: ollama.embeddingReranking(embeddingModel),
      documents: emailInbox,
      query: emailQuery,
      topN: 3,
    });

    console.log('Most relevant emails:');
    result2.ranking.forEach((item, i) => {
      const email = result2.rerankedDocuments[i];
      console.log(`  ${i + 1}. [${item.score.toFixed(3)}] ${email.from}`);
      console.log(`     Subject: ${email.subject}`);
    });

    const topEmail = result2.rerankedDocuments[0];
    const isDatadogEmail = topEmail.from.includes('datadog');
    console.log(`\n  Datadog email ranked #1: ${isDatadogEmail ? 'YES' : 'NO'}`);
    console.log();
  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.log();
  }

  // =========================================================================
  // Example 3: RAG Pipeline - Documentation Search
  // =========================================================================

  console.log('Example 3: RAG Documentation Search');
  console.log('='.repeat(50));
  console.log('Scenario: User asks "How do I handle API errors?"');
  console.log('This simulates a RAG pipeline where we rerank retrieved docs\n');

  try {
    const ragQuery = 'How do I handle API errors?';

    const result3 = await rerank({
      model: ollama.embeddingReranking(embeddingModel),
      documents: productDocs,
      query: ragQuery,
      topN: 2,
    });

    console.log('Top 2 docs to include in LLM context:');
    result3.ranking.forEach((item, i) => {
      const doc = result3.rerankedDocuments[i];
      console.log(`  ${i + 1}. [${item.score.toFixed(3)}] ${doc.slice(0, 100)}...`);
    });

    const topDoc = result3.rerankedDocuments[0];
    const isErrorDoc = topDoc.toLowerCase().includes('error');
    console.log(`\n  Error handling doc ranked #1: ${isErrorDoc ? 'YES' : 'NO'}`);
    console.log('  → These docs would be passed to the LLM for answer generation');
    console.log();
  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.log();
  }

  // =========================================================================
  // Example 4: Security Alert Search
  // =========================================================================

  console.log('Example 4: Security-Related Email Search');
  console.log('='.repeat(50));
  console.log('Scenario: "Show me any security alerts"');
  console.log(`Searching ${emailInbox.length} emails...\n`);

  try {
    const securityQuery = 'Show me any security alerts or login notifications';

    const result4 = await rerank({
      model: ollama.embeddingReranking(embeddingModel),
      documents: emailInbox,
      query: securityQuery,
      topN: 2,
    });

    console.log('Security-related emails:');
    result4.ranking.forEach((item, i) => {
      const email = result4.rerankedDocuments[i];
      console.log(`  ${i + 1}. [${item.score.toFixed(3)}] ${email.subject}`);
      console.log(`     From: ${email.from}`);
    });

    const topEmail = result4.rerankedDocuments[0];
    const isSecurityEmail = topEmail.subject.toLowerCase().includes('security') ||
                           topEmail.subject.toLowerCase().includes('sign-in');
    console.log(`\n  Security email ranked #1: ${isSecurityEmail ? 'YES' : 'NO'}`);
    console.log();
  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.log();
  }

  // =========================================================================
  // Summary
  // =========================================================================

  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`
Reranking improves search relevance by scoring documents against a query
using semantic similarity. Key use cases:

  1. Customer Support: Surface relevant help articles
  2. Email Search: Find specific emails in a crowded inbox
  3. RAG Pipelines: Select best context documents for LLM generation
  4. Security Monitoring: Quickly find security-related notifications

Tips for best results:
  - Use embeddinggemma for better score separation
  - More specific queries produce better rankings
  - Use topN to limit context size for RAG applications
  - Object documents are automatically converted to JSON for embedding
`);
}

main().catch(console.error);
