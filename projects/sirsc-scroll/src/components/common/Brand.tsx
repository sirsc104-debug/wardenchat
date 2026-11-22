/** SirSC Scroll mark: a stack of vertical clips with a play notch. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect x="13" y="2.5" width="14" height="22" rx="3.5" fill="none" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="1.6" transform="rotate(10 20 13.5)" />
      <rect x="7" y="6" width="15" height="23.5" rx="4" fill="url(#bm-g)" />
      <path d="M12.6 13.2v8.6c0 .7.8 1.1 1.4.7l6.4-4.3a.85.85 0 0 0 0-1.4L14 12.5c-.6-.4-1.4 0-1.4.7Z" fill="var(--accent-ink)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wm-sirsc">SirSC</span>
      <span className="wm-scroll">Scroll</span>
    </span>
  );
}
