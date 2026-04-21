import { ArrowLeft, Calendar, User, Briefcase } from 'lucide-react';
import type { AffiliateMeta } from '../utils/affiliateMeta';
import './AffiliateHeader.css';

interface Props {
  meta: AffiliateMeta;
  onBack: () => void;
}

export function AffiliateHeader({ meta, onBack }: Props) {
  return (
    <div className="affiliate-header">
      <button type="button" className="affiliate-header__back" onClick={onBack}>
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="affiliate-header__top">
        <div className="affiliate-header__identity">
          <div className="affiliate-header__label">Partner ID</div>
          <div className="affiliate-header__id">{meta.id || '—'}</div>
          {meta.name && <div className="affiliate-header__name">{meta.name}</div>}
        </div>

        <div className="affiliate-header__facts">
          {meta.companyName && (
            <div className="affiliate-header__fact">
              <Briefcase size={12} />
              <span className="affiliate-header__fact-label">Company</span>
              <span className="affiliate-header__fact-value">{meta.companyName}</span>
            </div>
          )}
          {meta.am && (
            <div className="affiliate-header__fact">
              <User size={12} />
              <span className="affiliate-header__fact-label">AM</span>
              <span className="affiliate-header__fact-value">{meta.am}</span>
            </div>
          )}
          {(meta.firstDate || meta.lastDate) && (
            <div className="affiliate-header__fact">
              <Calendar size={12} />
              <span className="affiliate-header__fact-label">Active</span>
              <span className="affiliate-header__fact-value">
                {meta.firstDate || '…'} → {meta.lastDate || '…'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="affiliate-header__mix">
        {meta.brandMix.length > 0 && (
          <div className="affiliate-header__pills-group">
            <span className="affiliate-header__pills-label">Brands</span>
            {meta.brandMix.map(b => (
              <span key={b.key} className="affiliate-header__pill">
                {b.key} <span className="affiliate-header__pill-count">{b.count}</span>
              </span>
            ))}
          </div>
        )}
        {meta.countryMix.length > 0 && (
          <div className="affiliate-header__pills-group">
            <span className="affiliate-header__pills-label">Countries</span>
            {meta.countryMix.map(c => (
              <span key={c.key} className="affiliate-header__pill affiliate-header__pill--alt">
                {c.key} <span className="affiliate-header__pill-count">{c.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
