/**
 * PageContainer.jsx
 * Wraps all page content with correct top + bottom padding
 * to prevent overlap with fixed header and bottom navigation.
 *
 * Props:
 *   children       — page content
 *   hasHeader      — boolean (default true) — adds padding-top for fixed header
 *   hasBottomNav   — boolean (default true) — adds padding-bottom for fixed nav
 *   extraBottom    — number in px (default 0) — additional bottom padding
 *   className      — optional extra classes
 *   noPadX         — boolean (default false) — removes horizontal padding (for maps)
 */
export default function PageContainer({
  children,
  hasHeader = true,
  hasBottomNav = true,
  extraBottom = 0,
  className = '',
  noPadX = false,
}) {
  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden ${noPadX ? '' : 'px-4'} ${className}`}
      style={{
        paddingTop: hasHeader ? '56px' : '0px',
        paddingBottom: hasBottomNav
          ? `calc(56px + env(safe-area-inset-bottom, 0px) + ${extraBottom + 16}px)`
          : `${extraBottom}px`,
      }}
    >
      {children}
    </div>
  );
}
