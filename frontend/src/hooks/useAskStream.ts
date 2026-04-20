import { useCallback, useReducer, useRef } from 'react';
import type { ChatTurn, DonePayload, ErrorCode, Message, StreamEvent } from '../types/askAi';

type State = {
  status: 'idle' | 'streaming' | 'done' | 'error';
  thread: Message[];
  liveStatus: string | null;
  liveAnswer: string;
};

type Action =
  | { type: 'SUBMIT'; question: string }
  | { type: 'STATUS'; message: string }
  | { type: 'TOKEN'; delta: string }
  | { type: 'DONE'; payload: DonePayload }
  | { type: 'ERROR'; code: ErrorCode; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SUBMIT':
      return {
        ...state,
        status: 'streaming',
        liveStatus: null,
        liveAnswer: '',
        thread: [...state.thread, { role: 'user', text: action.question, ts: Date.now() }],
      };
    case 'STATUS':
      return { ...state, liveStatus: action.message };
    case 'TOKEN':
      return { ...state, liveAnswer: state.liveAnswer + action.delta };
    case 'DONE':
      return {
        ...state, status: 'done', liveStatus: null,
        thread: [...state.thread, {
          role: 'assistant', text: action.payload.answer || state.liveAnswer,
          tools_used: action.payload.tools_used,
          prompt_tokens: action.payload.prompt_tokens,
          completion_tokens: action.payload.completion_tokens,
          total_tokens: action.payload.total_tokens,
          duration_ms: action.payload.duration_ms,
          log_id: action.payload.log_id,
          ts: Date.now(),
        }],
        liveAnswer: '',
      };
    case 'ERROR':
      return {
        ...state, status: 'error', liveStatus: null, liveAnswer: '',
        thread: [...state.thread, {
          role: 'assistant_error', code: action.code, message: action.message, ts: Date.now(),
        }],
      };
    default:
      return state;
  }
}

const initial: State = { status: 'idle', thread: [], liveStatus: null, liveAnswer: '' };

export function useAskStream(sessionId: string) {
  const [state, dispatch] = useReducer(reducer, initial);
  const buffer = useRef('');

  const ask = useCallback(async (question: string) => {
    dispatch({ type: 'SUBMIT', question });
    const history: ChatTurn[] = state.thread.flatMap((m): ChatTurn[] => {
      if (m.role === 'user')      return [{ role: 'user', text: m.text }];
      if (m.role === 'assistant') return [{ role: 'assistant', text: m.text }];
      return [];
    });

    let resp: Response;
    try {
      resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ question, history }),
      });
    } catch {
      dispatch({ type: 'ERROR', code: 'MODEL_FAILED', message: 'Network error.' });
      return;
    }

    if (!resp.ok || !resp.body) {
      dispatch({ type: 'ERROR', code: 'MODEL_FAILED', message: `HTTP ${resp.status}` });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    buffer.current = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer.current += decoder.decode(value, { stream: true });
      const events = parseSseChunk(buffer.current);
      // Trim consumed bytes
      const lastBoundary = buffer.current.lastIndexOf('\n\n');
      if (lastBoundary >= 0) buffer.current = buffer.current.slice(lastBoundary + 2);

      for (const ev of events) {
        if (ev.type === 'status') dispatch({ type: 'STATUS', message: ev.message });
        if (ev.type === 'token')  dispatch({ type: 'TOKEN',  delta: ev.delta });
        if (ev.type === 'done')   dispatch({ type: 'DONE',   payload: ev.payload });
        if (ev.type === 'error')  dispatch({ type: 'ERROR',  code: ev.code, message: ev.message });
      }
    }
  }, [sessionId, state.thread]);

  return { state, ask };
}

export function parseSseChunk(raw: string): StreamEvent[] {
  const out: StreamEvent[] = [];
  const frames = raw.split('\n\n').filter(Boolean);
  for (const frame of frames) {
    const lines = frame.split('\n');
    let event = '', data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (!event || !data) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { continue; }
    if (event === 'status') out.push({ type: 'status', message: (parsed as { message: string }).message });
    if (event === 'token')  out.push({ type: 'token',  delta: (parsed as { delta: string }).delta });
    if (event === 'done')   out.push({ type: 'done',   payload: parsed as DonePayload });
    if (event === 'error')  out.push({ type: 'error',  code: (parsed as { code: ErrorCode; message: string }).code, message: (parsed as { code: ErrorCode; message: string }).message });
  }
  return out;
}
