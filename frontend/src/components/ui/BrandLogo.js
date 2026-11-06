// The logo files live in public/brand (not src) so the build serves them as
// plain files and never compiles them into React components.
const markUrl = `${process.env.PUBLIC_URL}/brand/devprep-mark.svg`;
const logoUrl = `${process.env.PUBLIC_URL}/brand/devprep-logo.svg`;

/** The circular DP mark. Size it with width/height classes. */
export function BrandMark({ className = 'w-8 h-8', alt = 'DevPrep' }) {
  return <img src={markUrl} alt={alt} className={`shrink-0 select-none ${className}`} draggable={false} />;
}

/** The full circular logo with the DevPrep wordmark. */
export function BrandLogo({ className = 'w-32 h-32', alt = 'DevPrep' }) {
  return <img src={logoUrl} alt={alt} className={`shrink-0 select-none ${className}`} draggable={false} />;
}
