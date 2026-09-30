import { describe, it, expect } from 'vitest';
import { experimental_evaluate as evaluate } from 'ai';
import { ollama } from '../index';

// Requires Ollama 0.35+ and `ollama pull nimble`.
describe(
  'Evaluate (decision models) Integration Tests',
  { timeout: 120_000 },
  () => {
    it('answers choice, boolean and score questions in one call', async () => {
      const { answers, usage } = await evaluate({
        model: ollama.evaluationModel('nimble'),
        state: {
          ticket: 'I was charged twice. Please refund the extra payment.',
        },
        questions: {
          team: {
            type: 'choice',
            instructions: 'Which team should handle this ticket?',
            criteria: {
              billing: 'Payments and refunds',
              technical: 'Bugs and integrations',
              other: null,
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

      expect(answers.team.choice).toBe('billing');
      expect(answers.refund.probability).toBeGreaterThan(0.5);
      expect(answers.urgency.score).toBeGreaterThanOrEqual(0);
      expect(answers.urgency.score).toBeLessThanOrEqual(2);
      expect(usage.inputTokens).toBeGreaterThan(0);
    });
  },
);
