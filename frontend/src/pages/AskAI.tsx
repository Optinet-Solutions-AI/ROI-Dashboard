import { useEffect, useState } from 'react';
import { useAskStream } from '../hooks/useAskStream';
import { AskInput } from '../components/AskAI/AskInput';
import { AssistantMessage } from '../components/AskAI/AssistantMessage';
import { ErrorBanner } from '../components/AskAI/ErrorBanner';
import { StatusLine } from '../components/AskAI/StatusLine';

const SESSION_KEY = 'roi_dashboard_ask_session_id';

const SUGGESTIONS = [
  'Which affiliates have the highest ROI?',
  'Show me top 5 campaigns by revenue',
  'What is the average conversion rate?',
  'Compare this month vs last month',
  'Which offers have the most clicks?',
  'Show me revenue by traffic source',
];

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function AskAI() {
  const [sessionId, setSessionId] = useState<string>('');
  useEffect(() => { setSessionId(getOrCreateSessionId()); }, []);
  const { state, ask } = useAskStream(sessionId);
  const inFlight  = state.status === 'streaming';
  const hasThread = state.thread.length > 0 || !!state.liveAnswer || !!state.liveStatus;

  if (!sessionId) return null;

  return (
    <div className="ask-page">
      {/* Header + search bar — always visible */}
      <div className="ask-hero">
        <h1 className="ask-hero__title">Ask AI</h1>
        <p className="ask-hero__subtitle">
          Ask anything about your affiliate performance data.
        </p>
        <AskInput disabled={inFlight} onSubmit={ask} />
        {!hasThread && (
          <div className="ask-suggestions">
            <span className="ask-suggestions__label">Try asking</span>
            <div className="ask-suggestions__chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ask-chip" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results — cards below the search bar */}
      {hasThread && (
        <div className="ask-results">
          {state.thread.map((m, i) => {
            if (m.role === 'user') return (
              <div key={i} className="ask-card">
                <div className="ask-card__question">{m.text}</div>
              </div>
            );
            if (m.role === 'assistant') return (
              <div key={i} className="ask-card ask-card--answer">
                <AssistantMessage text={m.text} />
              </div>
            );
            if (m.role === 'assistant_error') return (
              <div key={i} className="ask-card ask-card--error">
                <ErrorBanner code={m.code} message={m.message} />
              </div>
            );
            return null;
          })}

          {/* In-flight streaming card */}
          {(state.liveStatus || state.liveAnswer) && (
            <div className="ask-card ask-card--answer ask-card--live">
              {state.liveStatus && <StatusLine message={state.liveStatus} />}
              {state.liveAnswer && <AssistantMessage text={state.liveAnswer} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
