export function UserMessage({ text }: { text: string }) {
  return <div className="ask-msg ask-msg--user">{text}</div>;
}
