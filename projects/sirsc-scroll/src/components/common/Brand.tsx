import logoUrl from '../../assets/sirsc-logo.webp';

/** The SirSC logo. */
export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return <img className={`brand-mark ${className}`} src={logoUrl} width={size} height={size} alt="" aria-hidden="true" draggable={false} decoding="async" />;
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wm-sirsc">SirSC</span>
      <span className="wm-scroll">Scroll</span>
    </span>
  );
}
