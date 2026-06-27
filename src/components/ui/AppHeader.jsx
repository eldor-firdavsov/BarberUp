import { ChevronLeft } from 'lucide-react';

export function AppHeader({ title, subtitle, onBack, rightAction, className = '' }) {
    return (
        <header className={`flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] safe-top ${className}`}>
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all shrink-0"
                    aria-label="Back"
                >
                    <ChevronLeft size={22} className="text-[var(--text-primary)]" />
                </button>
            )}
            <div className="flex-1 min-w-0">
                {title && <h1 className="text-lg font-bold text-[var(--text-primary)] truncate leading-tight">{title}</h1>}
                {subtitle && <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>}
            </div>
            {rightAction && <div className="shrink-0">{rightAction}</div>}
        </header>
    );
}

export default AppHeader;
