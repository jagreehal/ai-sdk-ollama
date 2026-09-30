/**
 * AI SDK v7: `experimental_evaluate` with an Ollama decision model
 *
 * Decision models answer typed questions (choice, boolean, score) about some
 * state with probabilities, in one fast local call. Requires Ollama 0.35+.
 *
 * Setup: ollama pull nimble
 * Run: pnpm --filter @examples/node exec tsx src/evaluate-example.ts
 */
import { ollama } from 'ai-sdk-ollama';
import { experimental_evaluate as evaluate } from 'ai';

async function main() {
  const tickets = [
    'I was charged twice. Please refund the extra payment.',
    'Checkout has returned 500 errors since 9am and we are losing sales!',
    'How do I export my data to CSV?',
  ];

  for (const ticket of tickets) {
    const { answers } = await evaluate({
      model: ollama.evaluationModel('nimble'),
      state: { ticket },
      questions: {
        team: {
          type: 'choice',
          instructions: 'Which team should handle this ticket?',
          criteria: {
            billing: 'Payments and refunds',
            technical: 'Bugs, errors and integrations',
            other: 'None of the above',
          },
        },
        refund: {
          type: 'boolean',
          instructions: 'Does the customer explicitly ask for a refund?',
        },
        urgency: {
          type: 'score',
          instructions: 'How urgent is this ticket?',
          criteria: ['Routine', 'Soon', 'Urgent'],
        },
      },
    });

    // Your policy stays in code: send uncertain routing to a human.
    const p = answers.team.probabilities?.[answers.team.choice] ?? 0;
    const queue = p < 0.7 ? 'triage' : answers.team.choice;

    console.log(ticket);
    console.log(
      `  queue=${queue} (p=${p.toFixed(2)}) refund=${answers.refund.probability.toFixed(2)} urgency=${answers.urgency.score.toFixed(2)}/2\n`,
    );
  }
}

main().catch(console.error);
