/**
 * AI SDK v7: Tool Approval (human-in-the-loop)
 *
 * v7 replaces the per-tool `needsApproval` property with a `toolApproval`
 * setting on `generateText`, `streamText`, and `ToolLoopAgent`. The policy
 * can return:
 *   - `'approved'`                      → run the tool automatically
 *   - `{ type: 'denied', reason }`      → block the tool automatically
 *   - `'user-approval'`                 → pause and ask a human
 *
 * When the policy asks for a human decision, the agent emits a
 * `tool-approval-request` part. You answer with a `ToolApprovalResponse`
 * (role: 'tool') and call the agent again. To keep this runnable without
 * typing input, the example decides the human answer in code.
 *
 * Run: pnpm --filter @examples/node exec tsx src/tool-approval-example.ts
 */
import { ollama } from 'ai-sdk-ollama';
import {
  ToolLoopAgent,
  isStepCount,
  tool,
  type ModelMessage,
  type ToolApprovalResponse,
} from 'ai';
import { z } from 'zod';
import { MODELS } from './model';

const deleteFile = tool({
  description: 'Delete the file at the given absolute path.',
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }) => ({ deleted: path }),
});

const agent = new ToolLoopAgent({
  model: ollama(MODELS.LLAMA_3_2),
  instructions:
    'You delete files using the deleteFile tool. Call deleteFile once for each ' +
    'path the user lists. If a deletion was not approved, do not retry it. ' +
    'Report that it was not approved.',
  tools: { deleteFile },
  stopWhen: isStepCount(8),
  // Approval policy: auto-approve scratch files, auto-deny system paths,
  // and ask a human for everything else.
  toolApproval: {
    deleteFile: ({ path }) => {
      if (path.startsWith('/tmp/')) return 'approved';
      if (path.startsWith('/etc/') || path.startsWith('/usr/')) {
        return { type: 'denied', reason: 'protected system path' };
      }
      return 'user-approval';
    },
  },
});

// Stand-in for a real prompt to the user. Here: approve files in a home dir.
function simulateUserDecision(path: string): boolean {
  return path.includes('/home/');
}

async function main() {
  console.log('=== Tool Approval / human-in-the-loop (v7) ===\n');

  const messages: ModelMessage[] = [
    {
      role: 'user',
      content:
        'Delete these files: /tmp/cache.log, /etc/passwd, and /home/me/notes.txt',
    },
  ];

  let approvals: ToolApprovalResponse[] = [];

  for (let round = 0; round < 5; round++) {
    if (approvals.length > 0) {
      messages.push({ role: 'tool', content: approvals });
      approvals = [];
    }

    const result = await agent.generate({ messages });
    messages.push(...result.responseMessages);

    let awaitingHuman = false;
    for (const step of result.steps) {
      for (const part of step.content) {
        switch (part.type) {
          case 'tool-approval-request': {
            // `isAutomatic` is true for policy-decided requests; we only need
            // to answer the ones routed to a human ('user-approval').
            if (!part.isAutomatic && !part.toolCall.dynamic) {
              const { path } = part.toolCall.input;
              const approved = simulateUserDecision(path);
              console.log(
                `🙋 User asked about deleteFile(${path}) → ${approved ? 'APPROVED' : 'DENIED'}`,
              );
              approvals.push({
                type: 'tool-approval-response',
                approvalId: part.approvalId,
                approved,
              });
              awaitingHuman = true;
            }
            break;
          }
          case 'tool-approval-response': {
            // Emitted for policy-decided (automatic) approvals/denials.
            if (!part.toolCall.dynamic) {
              const { path } = part.toolCall.input;
              console.log(
                `⚙️  Policy ${part.approved ? 'approved' : 'denied'} deleteFile(${path})` +
                  (part.reason ? `: ${part.reason}` : ''),
              );
            }
            break;
          }
          case 'tool-result': {
            console.log(`✅ Executed: ${JSON.stringify(part.output)}`);
            break;
          }
        }
      }
    }

    if (!awaitingHuman) {
      console.log(`\nFinal answer:\n${result.text}`);
      break;
    }
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
