export function SegmentedControl({ options, value, onChange, className = '' }) {
    return (
        <div className={`flex bg-[var(--bg-input)] p-1 rounded-[var(--radius-lg)] ${className}`}>
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`
                            flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[var(--radius-md)]
                            text-sm font-semibold transition-all duration-200 min-h-[44px]
                            ${active
                                ? 'bg-white text-[var(--text-primary)] shadow-[var(--card-shadow-subtle)]'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
                        `}
                    >
                        {opt.icon && <opt.icon size={16} />}
                        <span>{opt.label}</span>
                        {opt.badge != null && opt.badge > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)]' : 'bg-[var(--bg-hover)]'}`}>
                                {opt.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export default SegmentedControl;
