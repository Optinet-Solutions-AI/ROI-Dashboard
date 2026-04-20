// api/ask.ts
import OpenAI from 'openai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { encodeSse } from './_lib/sseEncoder.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import { runRelevanceGuard } from './_lib/safety/relevanceGuard.js';
import { runAgent } from './_lib/agent.js';
import { TOOL_FUNCTIONS } from './_lib/tools/index.js';
import { getLogsClient, insertLog } from './_lib/db/logsClient.js';
import type {
  AskRequest, ErrorCode, LogStatus, SseEvent, ChatTurn,
} from './_lib/types.js';

const TOTAL_TIMEOUT_MS = 50_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const sessionId = String(req.headers['x-session-id'] ?? '').trim();
  if (!sessionId) {
    res.status(400).json({ error: 'x-session-id header required' });
    return;
  }

  const body = req.body as AskRequest;
  const question = (body?.question ?? '').trim();
  if (!question) {
    res.status(400).json({ error: 'question is required' });
    return;
  }
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: SseEvent) => res.write(encodeSse(event));
  const sendError = (code: ErrorCode, message: string) =>
    send({ type: 'error', data: { code, message } });

  const startedAt = Date.now();
  const supabase  = getLogsClient();
  let logStatus: LogStatus = 'ok';
  let logAnswer: string | null = null;
  let logErrorCode: ErrorCode | null = null;
  let toolsUsed: any[] = [];
  let iterations = 0, prompt_tokens = 0, completion_tokens = 0, total_tokens = 0;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || null;

  const finishLog = async () => {
    try {
      const { id } = await insertLog({
        session_id: sessionId,
        question,
        answer: logAnswer,
        status: logStatus,
        error_code: logErrorCode,
        tools_used: toolsUsed,
        iterations, prompt_tokens, completion_tokens, total_tokens,
        duration_ms: Date.now() - startedAt,
        client_ip: clientIp,
      });
      return id;
    } catch (err) {
      console.error('[ask] insertLog failed:', err);
      return 'unknown';
    }
  };

  // Wall-clock guard
  const timeout = setTimeout(() => {
    logStatus = 'iteration_cap';
    logErrorCode = 'ITERATION_CAP';
    sendError('ITERATION_CAP', 'Took too long. Try a narrower question.');
    finishLog().finally(() => res.end());
  }, TOTAL_TIMEOUT_MS);

  try {
    // 1. Rate limit
    const rl = await checkRateLimit(supabase, sessionId);
    if (!rl.allowed) {
      logStatus = 'rate_limited';
      logErrorCode = 'RATE_LIMITED';
      const msg = rl.reason === 'global'
        ? 'The dashboard has hit its hourly Ask AI limit. Try again soon.'
        : `You've hit your hourly limit. Try again at ${rl.retry_at?.toLocaleTimeString() ?? 'later'}.`;
      sendError('RATE_LIMITED', msg);
      const log_id = await finishLog();
      send({ type: 'done', data: doneEmpty(log_id) });
      return cleanup();
    }

    // 2. Relevance guard
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    send({ type: 'status', data: { message: 'Reading your question…' } });
    const guard = await runRelevanceGuard(openai, question);
    total_tokens += guard.tokens;
    if (guard.verdict === 'off_topic') {
      logStatus = 'off_topic';
      logErrorCode = 'OFF_TOPIC';
      sendError('OFF_TOPIC',
        'I can only answer questions about your affiliate performance data. Try asking about revenue, ROI, top affiliates, etc.');
      const log_id = await finishLog();
      send({ type: 'done', data: doneEmpty(log_id) });
      return cleanup();
    }

    // 3. Agent loop
    const result = await runAgent({
      openai,
      question,
      history,
      tools: TOOL_FUNCTIONS as any,
      onStatus: (msg) => send({ type: 'status', data: { message: msg } }),
      onToken:  (delta) => send({ type: 'token',  data: { delta } }),
    });

    logStatus = result.status;
    logAnswer = result.answer;
    toolsUsed = result.tools_used;
    iterations = result.iterations;
    prompt_tokens     += result.prompt_tokens;
    completion_tokens += result.completion_tokens;
    total_tokens      += result.total_tokens;

    if (result.status !== 'ok') {
      logErrorCode = mapErrorCode(result.status);
      sendError(logErrorCode, friendlyMessage(logErrorCode));
      const log_id = await finishLog();
      send({ type: 'done', data: doneEmpty(log_id) });
      return cleanup();
    }

    const log_id = await finishLog();
    send({
      type: 'done',
      data: {
        answer: result.answer,
        tools_used: result.tools_used.map((t) => t.name),
        prompt_tokens, completion_tokens, total_tokens,
        duration_ms: Date.now() - startedAt,
        log_id,
      },
    });
    return cleanup();
  } catch (err) {
    console.error('[ask] unexpected error:', err);
    logStatus = 'model_failed';
    logErrorCode = 'MODEL_FAILED';
    sendError('MODEL_FAILED', 'Something went wrong. Please try again.');
    await finishLog();
    return cleanup();
  }

  function cleanup() {
    clearTimeout(timeout);
    res.end();
  }
}

function mapErrorCode(s: LogStatus): ErrorCode {
  switch (s) {
    case 'iteration_cap': return 'ITERATION_CAP';
    case 'token_budget':  return 'TOKEN_BUDGET';
    case 'tool_failed':   return 'TOOL_FAILED';
    case 'model_failed':  return 'MODEL_FAILED';
    case 'sql_rejected':  return 'SQL_REJECTED';
    default:              return 'MODEL_FAILED';
  }
}

function friendlyMessage(c: ErrorCode): string {
  switch (c) {
    case 'ITERATION_CAP':
    case 'TOKEN_BUDGET':
      return 'I couldn\'t fully answer that. Try narrowing the question (e.g. add a date range or a specific brand).';
    case 'TOOL_FAILED':
    case 'MODEL_FAILED':
      return 'Something went wrong. Please try again.';
    default:
      return 'Something went wrong.';
  }
}

function doneEmpty(log_id: string) {
  return {
    answer: '', tools_used: [],
    prompt_tokens: 0, completion_tokens: 0, total_tokens: 0,
    duration_ms: 0, log_id,
  };
}
