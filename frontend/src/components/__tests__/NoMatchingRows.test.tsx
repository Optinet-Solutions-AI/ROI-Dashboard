import { describe, it, expect, afterEach } from 'vitest';
import { useRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoMatchingRows } from '../NoMatchingRows';
import { FilterProvider, useFilters } from '../../contexts/FilterContext';

afterEach(cleanup);

function TestHarness({ initialSearch = '' }: { initialSearch?: string }) {
  return (
    <FilterProvider>
      <Seeder initialSearch={initialSearch} />
      <NoMatchingRows entity="things" />
    </FilterProvider>
  );
}

function Seeder({ initialSearch }: { initialSearch: string }) {
  const { filters, updateFilter } = useFilters();
  const seeded = useRef(false);
  if (initialSearch && !seeded.current) {
    seeded.current = true;
    queueMicrotask(() => updateFilter('searchTerm', initialSearch));
  }
  return <div data-testid="seeder-search">{filters.searchTerm}</div>;
}

describe('NoMatchingRows', () => {
  it('pluralizes "filters are active" correctly', async () => {
    render(<TestHarness initialSearch="acme" />);
    await screen.findByText('acme');
    expect(screen.getByText(/1 filter is active/i)).toBeTruthy();
    expect(screen.getByText(/No things match the current filters/i)).toBeTruthy();
  });

  it('clears the filter state when Clear all filters is clicked', async () => {
    const user = userEvent.setup();
    render(<TestHarness initialSearch="acme" />);
    await screen.findByText('acme');

    await user.click(screen.getByRole('button', { name: /Clear all filters/i }));

    expect(screen.getByTestId('seeder-search').textContent).toBe('');
  });
});
