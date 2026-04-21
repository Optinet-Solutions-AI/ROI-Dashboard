import { FilterX } from 'lucide-react';
import { useFilters } from '../contexts/FilterContext';

/**
 * Rendered by pivot/list pages when filters reduce results to zero.
 * Reads the FilterContext directly so callers don't need to pass a reset
 * handler. Safe to render inside any tree wrapped by <FilterProvider>.
 */
export function NoMatchingRows({ entity = 'rows' }: { entity?: string }) {
  const { reset, activeCount } = useFilters();

  return (
    <div className="no-matching-rows" role="status">
      <div className="no-matching-rows__icon">
        <FilterX size={28} />
      </div>
      <h3>No {entity} match the current filters</h3>
      <p>
        {activeCount === 1
          ? '1 filter is active.'
          : `${activeCount} filters are active.`}{' '}
        Try widening or clearing them.
      </p>
      <button type="button" className="no-matching-rows__reset" onClick={reset}>
        Clear all filters
      </button>
    </div>
  );
}
