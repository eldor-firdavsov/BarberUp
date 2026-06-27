import { Clock } from 'lucide-react';

export function ListRow({
    time,
    date,
    title,
    subtitle,
    meta,
    actions,
    onClick,
    className = '',
}) {
    return (
        <div
            onClick={onClick}
            className={`
                flex items-center gap-3 p-4 bg-[var(--bg-card)] rounded-[var(--radius-card)]
                border border-[var(--border-subtle)] shadow-[var(--card-shadow-subtle)]
                ${onClick ? 'cursor-pointer hover:bg-[var(--bg-hover)] active:scale-[0.99] transition-all' : ''}
                ${className}
            `}
        >
            {(time || date) && (
                <div className="shrink-0 text-center min-w-[52px]">
                    {time && (
                        <div className="text-lg font-bold text-[var(--text-primary)] leading-tight tabular-nums">
                            {time}
                        </div>
                    )}
                    {date && (
                        <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mt-0.5">
                            {date}
                        </div>
                    )}
                </div>
            )}
            <div className="flex-1 min-w-0 border-l border-[var(--border-subtle)] pl-3">
                {title && <p className="font-bold text-sm text-[var(--text-primary)] truncate">{title}</p>}
                {subtitle && <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{subtitle}</p>}
                {meta && <div className="mt-1.5">{meta}</div>}
            </div>
            {actions && <div className="shrink-0 flex gap-2">{actions}</div>}
        </div>
    );
}

export function AppointmentRow({ time, dateLabel, service, barber, actions, onClick }) {
    return (
        <ListRow
            time={time}
            date={dateLabel}
            title={service}
            subtitle={barber}
            actions={actions}
            onClick={onClick}
        />
    );
}

export function TimeChip({ children, selected, disabled, onClick }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`
                inline-flex items-center gap-1 px-3 py-2 rounded-[var(--radius-md)] text-sm font-semibold
                transition-all min-h-[40px] tabular-nums
                ${disabled ? 'bg-[var(--bg-input)] text-[var(--text-tertiary)] cursor-not-allowed line-through' : ''}
                ${!disabled && selected ? 'bg-[var(--brand-primary)] text-white shadow-[var(--btn-shadow)]' : ''}
                ${!disabled && !selected ? 'bg-white border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-primary)]' : ''}
            `}
        >
            <Clock size={12} className={selected ? 'opacity-80' : 'text-[var(--text-secondary)]'} />
            {children}
        </button>
    );
}

export default ListRow;
