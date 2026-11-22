import { Minus, Plus } from 'lucide-react';
import { CATEGORY_ICON } from '../common/icons';
import { useAcct } from '../../state/store';
import { nudgeInterest, setInterest } from '../../state/actions';
import { INTEREST_MAX, INTEREST_MIN, topInterests } from '../../lib/recommend';
import { CATEGORY_IDS, categoryLabel } from '../../data/categories';

/** Shows the account's learned category weights and lets the user raise or lower each one. */
export function InterestEditor() {
  const acct = useAcct((a) => a);
  // Fixed order so a row doesn't jump away while its slider is being dragged.
  const ranked = topInterests(acct);
  const top3 = new Set(ranked.slice(0, 3).map((x) => x.category));
  const list = [...ranked].sort((a, b) => CATEGORY_IDS.indexOf(a.category) - CATEGORY_IDS.indexOf(b.category));
  const signals = acct.signals;
  const learned = signals.likes + signals.saves + signals.follows + signals.comments + signals.completions + signals.skips + signals.notInterested;
  return (
    <div className="interests">
      <ul className="interest-list">
        {list.map((x) => {
          const Icon = CATEGORY_ICON[x.category];
          return (
            <li key={x.category} className={top3.has(x.category) ? 'top' : ''}>
              <span className="interest-name">
                <Icon size={14} /> {categoryLabel(x.category)}
              </span>
              <button type="button" className="icon-btn xs" onClick={() => nudgeInterest(x.category, -0.4)} disabled={x.weight <= INTEREST_MIN} aria-label={`Less ${categoryLabel(x.category)}`}>
                <Minus size={13} />
              </button>
              <input type="range" min={INTEREST_MIN} max={INTEREST_MAX} step={0.1} value={x.weight} onChange={(e) => setInterest(x.category, Number(e.target.value))} aria-label={`${categoryLabel(x.category)} interest`} />
              <button type="button" className="icon-btn xs" onClick={() => nudgeInterest(x.category, 0.4)} disabled={x.weight >= INTEREST_MAX} aria-label={`More ${categoryLabel(x.category)}`}>
                <Plus size={13} />
              </button>
              <b className="interest-pct">{Math.round(x.share * 100)}%</b>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Learned from {learned} interactions in this browser: {signals.likes} likes, {signals.saves} saves, {signals.follows} follows, {signals.comments} comments, {signals.completions} full watches, {signals.replays} replays, {signals.skips} quick skips and {signals.notInterested} “not interested”. This is simple weighted scoring, not machine learning.
      </p>
    </div>
  );
}
