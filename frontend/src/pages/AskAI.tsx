import { useEffect, useState } from 'react';
import { useAskStream } from '../hooks/useAskStream';
import { MessageThread } from '../components/AskAI/MessageThread';
import { AskInput } from '../components/AskAI/AskInput';

const SESSION_KEY = 'roi_dashboard_ask_session_id';

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
  const inFlight = state.status === 'streaming';

  if (!sessionId) return null;

  return (
    <div className="ask-page">
      <header className="ask-page__header">
        <h1>Ask AI</h1>
        <p>Ask anything about your affiliate performance data.</p>
      </header>
      <MessageThread
        thread={state.thread}
        liveStatus={state.liveStatus}
        liveAnswer={state.liveAnswer}
      />
      <AskInput disabled={inFlight} onSubmit={ask} />
    </div>
  );
}
