import type OpenAI from 'openai';
import type {
  ChatCompletionMessageParam, ChatCompletionTool, ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';
import type { ChatTurn, LogStatus, ToolUseRecord } from './types.js';
import { TOOL_SCHEMAS, STATUS_MESSAGE, type ToolName } from './tools/index.js';

export const ITERATION_CAP  = 5;
export const TOKEN_BUDGET   = 8_000;
export const MAX_TOOL_BYTES = 10_240;
export const HISTORY_TURNS  = 6;

export const SYSTEM_PROMPT = `You are an analyst for an affiliate-marketing dashboard.
You have access to a single dataset: performance_records.

Schema:
  affiliate_id, affiliate_name, country, campaign, brand, am, source,
  period, date, clicks, registrations, ftds, revenue, cost,
  casino_real_ngr, sb_real_ngr, flats_and_adjustments

Business glossary:
  profit          = revenue - cost
  ROI             = profit / cost
  CPA             = cost / ftds
  conversion_rate = ftds / clicks

Rules:
- Use the provided tools to get data. Never invent numbers.
- Aggregate inside tools, not in your head.
- If a question can't be answered with the available data, say so clearly.
- NEVER mention tool names, SQL, column names, or internals to the user.
- Format money as $X,XXX, percentages as XX.X%, dates as Mon DD YYYY.
- Keep answers concise. Use markdown tables for >3 rows of comparisons.`;

export type AgentInput = {
  openai: OpenAI;
  question: string;
  history: ChatTurn[];
  onStatus: (msg: string) => void;
  onToken:  (delta: string) => void;
  tools: Record<string, (args: any) => Promise<any>>;
};

export type AgentResult = {
  status: LogStatus;
  answer: string;
  tools_used: ToolUseRecord[];
  iterations: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type AccumulatedToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];
  for (const turn of input.history.slice(-HISTORY_TURNS)) {
    messages.push({ role: turn.role, content: turn.text });
  }
  messages.push({ role: 'user', content: input.question });

  const tools_used: ToolUseRecord[] = [];
  let prompt_tokens = 0, completion_tokens = 0, total_tokens = 0;
  let iterations = 0;

  input.onStatus('Analyzing performance data…');

  while (iterations < ITERATION_CAP) {
    iterations++;
    if (total_tokens >= TOKEN_BUDGET) return done('token_budget', '');

    const stream = await input.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages,
      tools: TOOL_SCHEMAS as ChatCompletionTool[],
      tool_choice: 'auto',
      stream: true,
      stream_options: { include_usage: true },
    } as any);

    let content = '';
    const toolCalls: AccumulatedToolCall[] = [];

    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.content) {
        content += delta.content;
        input.onToken(delta.content);
      }

      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const idx = tcDelta.index ?? 0;
          if (!toolCalls[idx]) {
            toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          }
          if (tcDelta.id)                  toolCalls[idx].id += tcDelta.id;
          if (tcDelta.function?.name)      toolCalls[idx].function.name      += tcDelta.function.name;
          if (tcDelta.function?.arguments) toolCalls[idx].function.arguments += tcDelta.function.arguments;
        }
      }

      if (chunk.usage) {
        prompt_tokens     += chunk.usage.prompt_tokens     ?? 0;
        completion_tokens += chunk.usage.completion_tokens ?? 0;
        total_tokens      += chunk.usage.total_tokens      ?? 0;
      }
    }

    const compactCalls = toolCalls.filter(Boolean);

    if (compactCalls.length === 0) {
      // Final answer turn
      return done('ok', content);
    }

    if (total_tokens >= TOKEN_BUDGET) return done('token_budget', content);

    // Push the assistant's tool-call message so the model can see its own request
    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: compactCalls as ChatCompletionMessageToolCall[],
    } as ChatCompletionMessageParam);

    // Execute each tool call
    for (const call of compactCalls) {
      const name = call.function.name as ToolName;
      input.onStatus(STATUS_MESSAGE[name] ?? 'Working on it…');

      let result: unknown;
      const t0 = Date.now();
      try {
        const args = JSON.parse(call.function.arguments || '{}');
        const fn = input.tools[name];
        if (!fn) throw new Error(`unknown tool: ${name}`);
        result = await fn(args);
      } catch (err: any) {
        if (err?.code === 'SQL_REJECTED') {
          tools_used.push({ name, args: call.function.arguments, result_bytes: 0, ms: Date.now() - t0 });
          messages.push({
            role: 'tool', tool_call_id: call.id,
            content: JSON.stringify({ error: 'SQL_REJECTED', detail: err.message }),
          });
          continue;
        }
        console.error(`[agent] tool ${name} failed:`, {
          message: err?.message, code: err?.code, detail: err?.detail, stack: err?.stack,
          args: call.function.arguments,
        });
        return done('tool_failed', '');
      }

      const serialized = clip(JSON.stringify(result));
      tools_used.push({
        name, args: call.function.arguments,
        result_bytes: Buffer.byteLength(serialized, 'utf8'),
        ms: Date.now() - t0,
      });
      messages.push({ role: 'tool', tool_call_id: call.id, content: serialized });
    }
  }

  return done('iteration_cap', '');

  function done(status: LogStatus, answer: string): AgentResult {
    return { status, answer, tools_used, iterations, prompt_tokens, completion_tokens, total_tokens };
  }
}

function clip(s: string): string {
  if (Buffer.byteLength(s, 'utf8') <= MAX_TOOL_BYTES) return s;
  return s.slice(0, MAX_TOOL_BYTES - 32) + '…[truncated]';
}
