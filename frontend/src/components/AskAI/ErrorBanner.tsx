import type { ErrorCode } from '../../types/askAi';

const VARIANT: Record<ErrorCode | 'UNKNOWN', string> = {
  RATE_LIMITED:  'ask-error rate-limited',
  OFF_TOPIC:     'ask-error off-topic',
  ITERATION_CAP: 'ask-error iteration-cap',
  TOKEN_BUDGET:  'ask-error iteration-cap',
  TOOL_FAILED:   'ask-error generic',
  MODEL_FAILED:  'ask-error generic',
  SQL_REJECTED:  'ask-error generic',
  UNKNOWN:       'ask-error generic',
};

export function ErrorBanner({ code, message }: { code: ErrorCode; message: string }) {
  const cls = VARIANT[code] ?? VARIANT.UNKNOWN;
  return <div className={cls} role="alert">{message}</div>;
}
