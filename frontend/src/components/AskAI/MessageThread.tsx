import { useEffect, useRef } from 'react';
import type { Message } from '../../types/askAi';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { ErrorBanner } from './ErrorBanner';
import { StatusLine } from './StatusLine';

type Props = {
  thread: Message[];
  liveStatus: string | null;
  liveAnswer: string;
};

export function MessageThread({ thread, liveStatus, liveAnswer }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread, liveStatus, liveAnswer]);

  return (
    <div className="ask-thread">
      {thread.map((m, i) => {
        if (m.role === 'user')            return <UserMessage      key={i} text={m.text} />;
        if (m.role === 'assistant')       return <AssistantMessage key={i} text={m.text} />;
        return <ErrorBanner key={i} code={m.code} message={m.message} />;
      })}
      {(liveStatus || liveAnswer) && (
        <div className="ask-msg ask-msg--assistant ask-msg--live">
          {liveStatus && <StatusLine message={liveStatus} />}
          {liveAnswer && <AssistantMessage text={liveAnswer} />}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
