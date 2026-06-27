export function AuthShell({ title, subtitle, onBack, children, footer }) {
    return (
        <section className="page-animate min-h-screen bg-[var(--bg-base)] flex flex-col justify-center px-6 py-10 max-w-md mx-auto">
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-white border border-[var(--border-subtle)] flex items-center justify-center mb-6 hover:bg-[var(--bg-hover)] transition-colors"
                    aria-label="Back"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
            )}

            <div className="text-center mb-8">
                <div className="w-14 h-14 bg-[var(--brand-primary)] rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5">
                    <img src="./Scissor.png" alt="" className="w-7 h-7 object-contain invert" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-[var(--text-secondary)] mt-2">{subtitle}</p>
                )}
            </div>

            <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] border border-[var(--border-subtle)] p-5 shadow-[var(--card-shadow)]">
                {children}
            </div>

            {footer && <div className="mt-6">{footer}</div>}
        </section>
    );
}

export default AuthShell;
