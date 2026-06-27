export function Card({ children, className = '', onClick, interactive = false }) {
    return (
        <div
            onClick={onClick}
            className={`
                bg-[var(--bg-card)] rounded-[var(--radius-card)] border border-[var(--border-subtle)]
                shadow-[var(--card-shadow)] overflow-hidden
                ${interactive ? 'cursor-pointer hover:shadow-[var(--card-shadow-hover)] active:scale-[0.99] transition-all duration-200' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
}

export function ShortcutCard({ image, title, subtitle, meta, onClick, action, className = '' }) {
    return (
        <Card interactive onClick={onClick} className={`flex gap-3 p-3 ${className}`}>
            {image && (
                <div className="w-20 h-20 shrink-0 rounded-[var(--radius-md)] overflow-hidden bg-[var(--bg-input)]">
                    {image}
                </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <h3 className="font-bold text-[var(--text-primary)] text-[15px] truncate leading-tight">{title}</h3>
                {subtitle && <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>}
                {meta && <div className="flex flex-wrap gap-1.5 mt-1">{meta}</div>}
            </div>
            {action && <div className="shrink-0 self-center">{action}</div>}
        </Card>
    );
}

export default Card;
