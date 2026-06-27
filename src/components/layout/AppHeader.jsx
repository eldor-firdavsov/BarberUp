/**
 * AppHeader.jsx
 * Fixed top header with correct z-index and safe-area-top padding.
 *
 * Props:
 *   title        — string: page title
 *   left         — ReactNode: left slot (back button, logo, etc.)
 *   right        — ReactNode: right slot (settings icon, notifications, etc.)
 *   transparent  — boolean: for pages with hero images
 */
export default function AppHeader({ title, left, right, transparent = false }) {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-60 flex items-center justify-between px-4
        ${transparent
          ? 'bg-transparent'
          : 'bg-white/90 backdrop-blur-md border-b border-black/5'}`}
      style={{
        height: '56px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="w-10 flex items-center justify-start">{left}</div>
      {title && (
        <h1 className="text-base font-bold text-[#111111] tracking-tight truncate">
          {title}
        </h1>
      )}
      <div className="w-10 flex items-center justify-end">{right}</div>
    </header>
  );
}
