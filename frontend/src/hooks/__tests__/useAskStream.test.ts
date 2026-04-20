import { describe, it, expect } from 'vitest';
import { parseSseChunk } from '../useAskStream';

describe('parseSseChunk', () => {
  it('parses a single status frame', () => {
    const events = parseSseChunk('event: status\ndata: {"message":"Hi"}\n\n');
    expect(events).toEqual([{ type: 'status', message: 'Hi' }]);
  });

  it('parses multiple frames in one chunk', () => {
    const chunk =
      'event: status\ndata: {"message":"A"}\n\n' +
      'event: token\ndata: {"delta":"B"}\n\n';
    const events = parseSseChunk(chunk);
    expect(events).toEqual([
      { type: 'status', message: 'A' },
      { type: 'token',  delta: 'B' },
    ]);
  });

  it('parses a done frame into the structured event', () => {
    const events = parseSseChunk(
      'event: done\ndata: {"answer":"x","tools_used":["t"],"prompt_tokens":1,"completion_tokens":1,"total_tokens":2,"duration_ms":10,"log_id":"L"}\n\n',
    );
    expect(events[0]).toMatchObject({ type: 'done', payload: { log_id: 'L' } });
  });

  it('parses an error frame', () => {
    const events = parseSseChunk('event: error\ndata: {"code":"OFF_TOPIC","message":"No"}\n\n');
    expect(events).toEqual([{ type: 'error', code: 'OFF_TOPIC', message: 'No' }]);
  });

  it('returns empty array for partial frames', () => {
    expect(parseSseChunk('event: status\ndata: {"messa')).toEqual([]);
  });
});
