export function Chip({ children, selected, disabled, onClick, className = '' }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`
                inline-flex items-center justify-center px-3 py-2 rounded-[var(--radius-md)]
                text-sm font-semibold transition-all min-h-[40px] tabular-nums
                ${disabled ? 'bg-[var(--bg-input)] text-[var(--text-tertiary)] cursor-not-allowed opacity-60' : ''}
                ${!disabled && selected ? 'bg-[var(--brand-primary)] text-white' : ''}
                ${!disabled && !selected ? 'bg-white border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-primary)]' : ''}
                ${className}
            `}
        >
            {children}
        </button>
    );
}

export default Chip;
