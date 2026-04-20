export function StatusLine({ message }: { message: string }) {
  return (
    <div className="ask-status">
      <span className="ask-status__spinner" />
      {message}
    </div>
  );
}
