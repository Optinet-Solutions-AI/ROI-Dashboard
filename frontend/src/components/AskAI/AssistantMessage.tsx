import ReactMarkdown from 'react-markdown';

export function AssistantMessage({ text }: { text: string }) {
  return (
    <div className="ask-msg ask-msg--assistant">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
