import { useEffect } from 'react';

export function Sheet({ isOpen, onClose, title, children, className = '', footer }) {
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div
                className="absolute inset-0 bg-black/40 animate-fadeIn"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className={`relative bg-[var(--bg-card)] rounded-t-[var(--radius-xl)] max-h-[90vh] flex flex-col animate-slideUp ${className}`}
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
                role="dialog"
            >
                {/* Drag handle & Header */}
                <div className="sticky top-0 bg-[var(--bg-card)] z-10 pt-3 pb-2 px-4 border-b border-[var(--border-subtle)] shrink-0">
                    <div className="w-10 h-1 bg-[var(--border-medium)] rounded-full mx-auto mb-3" />
                    {title && (
                        <h2 className="text-lg font-bold text-[var(--text-primary)] text-center">{title}</h2>
                    )}
                </div>

                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto p-4">
                    {children}
                </div>

                {/* Fixed action button footer */}
                {footer && (
                    <div className="shrink-0 p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Sheet;
