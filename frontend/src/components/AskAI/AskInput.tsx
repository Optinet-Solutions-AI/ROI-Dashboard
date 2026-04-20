import { useState, useRef } from 'react';
import { Sparkles, Mic, MicOff, Send } from 'lucide-react';

const hasSpeechAPI = () =>
  typeof window !== 'undefined' &&
  !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export function AskInput({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (q: string) => void;
}) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const q = value.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setValue('');
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      setValue(e.results[0][0].transcript);
      inputRef.current?.focus();
    };
    rec.onend  = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="ask-search-bar">
      <Sparkles size={16} className="ask-search-bar__prefix" />
      <input
        ref={inputRef}
        type="text"
        className="ask-search-bar__input"
        value={value}
        placeholder="Ask anything about your data..."
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      {hasSpeechAPI() && (
        <button
          type="button"
          className={`ask-search-bar__icon-btn${listening ? ' listening' : ''}`}
          onClick={toggleMic}
          disabled={disabled}
          aria-label={listening ? 'Stop recording' : 'Speak your question'}
        >
          {listening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
      )}
      <button
        type="button"
        className="ask-search-bar__submit"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
      >
        <Send size={15} />
      </button>
    </div>
  );
}
