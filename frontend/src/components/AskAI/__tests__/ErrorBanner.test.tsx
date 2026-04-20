import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBanner } from '../ErrorBanner';

describe('ErrorBanner', () => {
  it('renders RATE_LIMITED with the given message', () => {
    render(<ErrorBanner code="RATE_LIMITED" message="Try again at 4pm" />);
    expect(screen.getByText(/Try again at 4pm/)).toBeInTheDocument();
    expect(screen.getByRole('alert').className).toMatch(/rate-limited/);
  });

  it('renders OFF_TOPIC with a soft yellow tone', () => {
    render(<ErrorBanner code="OFF_TOPIC" message="Off topic" />);
    expect(screen.getByRole('alert').className).toMatch(/off-topic/);
  });

  it('renders ITERATION_CAP', () => {
    render(<ErrorBanner code="ITERATION_CAP" message="Too long" />);
    expect(screen.getByRole('alert').className).toMatch(/iteration-cap/);
  });

  it('falls back to a generic style for unknown codes', () => {
    render(<ErrorBanner code={'UNKNOWN' as any} message="x" />);
    expect(screen.getByRole('alert').className).toMatch(/generic/);
  });
});
