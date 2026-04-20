import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAskStream } from '../hooks/useAskStream';
import { MessageThread } from '../components/AskAI/MessageThread';
import { AskInput } from '../components/AskAI/AskInput';

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
    <div className={`ask-page${hasThread ? ' ask-page--active' : ''}`}>
      {!hasThread ? (
        <div className="ask-hero">
          <div className="ask-hero__icon"><Sparkles size={28} /></div>
          <h1 className="ask-hero__title">Ask AI</h1>
          <p className="ask-hero__subtitle">
            Ask anything about your affiliate performance data.
          </p>
          <AskInput disabled={inFlight} onSubmit={ask} />
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
        </div>
      ) : (
        <>
          <MessageThread
            thread={state.thread}
            liveStatus={state.liveStatus}
            liveAnswer={state.liveAnswer}
          />
          <AskInput disabled={inFlight} onSubmit={ask} />
        </>
      )}
    </div>
  );
}
