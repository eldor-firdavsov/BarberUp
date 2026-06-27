export function Button({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled,
    type = 'button',
    ...props
}) {
    const base = 'inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
    const sizes = {
        sm: 'h-9 px-3 text-xs rounded-[var(--radius-md)]',
        md: 'h-11 px-5 text-sm rounded-[var(--radius-lg)]',
        lg: 'h-12 px-6 text-sm rounded-[var(--radius-lg)]',
    };
    const variants = {
        primary: 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] shadow-[var(--btn-shadow)]',
        secondary: 'bg-white text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]',
        ghost: 'bg-transparent text-[var(--brand-primary)] hover:bg-[var(--brand-primary-light)]',
        danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100',
    };

    return (
        <button
            type={type}
            disabled={disabled}
            className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

export default Button;
