import { useState } from 'react';

export function AskInput({
  disabled, onSubmit,
}: { disabled: boolean; onSubmit: (q: string) => void }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const q = value.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setValue('');
  };
  return (
    <div className="ask-input">
      <textarea
        rows={2}
        value={value}
        placeholder="Ask a question about your data…"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <button onClick={submit} disabled={disabled || !value.trim()}>▶</button>
    </div>
  );
}
