export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
            {Icon && (
                <div className="w-14 h-14 rounded-full bg-[var(--bg-input)] flex items-center justify-center mb-4">
                    <Icon size={28} className="text-[var(--text-tertiary)]" />
                </div>
            )}
            {title && <p className="font-bold text-[var(--text-primary)] text-sm">{title}</p>}
            {description && <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[240px]">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export default EmptyState;
