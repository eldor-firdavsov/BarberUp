/**
 * NotificationPanel.jsx
 * Slide-down panel showing all unread notifications.
 * Each notification has:
 *   - Dismiss (×) button — marks as read, removes from list
 *   - Accept (✓) button — accepts the booking, removes notification
 *   - Reject (✕) button — rejects the booking, removes notification
 *
 * Props:
 *   barberId   — string: current barber's ID
 *   isOpen     — boolean
 *   onClose    — () => void
 *   onAction   — () => void: called after any accept/reject to refresh parent
 */
import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase.js';
import {
    getUnreadNotifications,
    dismissNotification,
    dismissAllNotifications,
    acceptFromNotification,
    rejectFromNotification,
} from '../api/notificationApi.js';
import { formatRelativeTime } from '../utils/dates.js';
import { t } from '../utils/i18n.js';

export default function NotificationPanel({ barberId, isOpen, onClose, onAction }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && barberId) {
            loadNotifications();
        }
    }, [isOpen, barberId]);

    // Realtime subscription — new notifications appear instantly
    useEffect(() => {
        if (!barberId) return;

        const channel = supabase
            .channel(`notifications:${barberId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `barber_id=eq.${barberId}`,
            }, (payload) => {
                setNotifications(prev => [payload.new, ...prev]);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [barberId]);

    async function loadNotifications() {
        setLoading(true);
        const { data } = await getUnreadNotifications(barberId);
        setNotifications(data);
        setLoading(false);
    }

    // Remove notification from local state immediately (optimistic)
    function removeLocal(id) {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }

    async function handleDismiss(notification) {
        removeLocal(notification.id);
        await dismissNotification(notification.id);
    }

    async function handleDismissAll() {
        setNotifications([]);
        await dismissAllNotifications(barberId);
    }

    async function handleAccept(notification) {
        removeLocal(notification.id);
        await acceptFromNotification(notification.id, notification.booking_id);
        onAction?.();
    }

    async function handleReject(notification) {
        removeLocal(notification.id);
        await rejectFromNotification(notification.id, notification.booking_id);
        onAction?.();
    }

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-30 bg-black/20"
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className="fixed inset-x-0 top-0 z-40 bg-white shadow-xl animate-slideDown"
                style={{
                    paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    borderBottomLeftRadius: '24px',
                    borderBottomRightRadius: '24px',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h2 className="text-base font-bold text-[#111]">
                        {t('notifications.title')}
                        {notifications.length > 0 && (
                            <span className="ml-2 text-xs font-bold text-white bg-[#EF4444]
                                px-1.5 py-0.5 rounded-full">
                                {notifications.length}
                            </span>
                        )}
                    </h2>
                    <div className="flex items-center gap-3">
                        {notifications.length > 0 && (
                            <button
                                onClick={handleDismissAll}
                                className="text-xs text-[#666] underline"
                            >
                                {t('notifications.dismissAll')}
                            </button>
                        )}
                        <button onClick={onClose} className="text-lg text-[#666] w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f7] active:bg-[#eee] transition-colors">×</button>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-[#378ADD] border-t-transparent
                            rounded-full animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-[#666]">
                        <span className="text-4xl mb-3">🔔</span>
                        <p className="text-sm">{t('notifications.empty')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notifications.map(n => (
                            <NotificationItem
                                key={n.id}
                                notification={n}
                                onDismiss={() => handleDismiss(n)}
                                onAccept={n.type === 'new_booking' ? () => handleAccept(n) : null}
                                onReject={n.type === 'new_booking' ? () => handleReject(n) : null}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Individual notification item ─────────────────────────────────────────────

function NotificationItem({ notification: n, onDismiss, onAccept, onReject }) {
    const typeIcon = {
        new_booking:          '📅',
        booking_cancelled:    '❌',
        booking_rescheduled:  '🔄',
        walk_in:              '🚶',
    }[n.type] ?? '🔔';

    return (
        <div className="px-4 py-4 flex gap-3">
            <span className="text-2xl shrink-0 mt-0.5">{typeIcon}</span>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111] leading-snug">{n.title}</p>
                <p className="text-xs text-[#666] mt-0.5 leading-snug">{n.body}</p>
                <p className="text-[10px] text-gray-400 mt-1.5">{formatRelativeTime(n.created_at)}</p>

                {/* Action buttons — only for new_booking type */}
                {(onAccept || onReject) && (
                    <div className="flex gap-2 mt-3">
                        {onAccept && (
                            <button
                                onClick={onAccept}
                                className="flex-1 py-2 rounded-xl bg-[#10B981] text-white text-xs font-bold
                                    active:scale-95 transition"
                            >
                                ✓ {t('notifications.accept')}
                            </button>
                        )}
                        {onReject && (
                            <button
                                onClick={onReject}
                                className="flex-1 py-2 rounded-xl bg-[#EF4444] text-white text-xs font-bold
                                    active:scale-95 transition"
                            >
                                ✕ {t('notifications.reject')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Dismiss button */}
            <button
                onClick={onDismiss}
                className="shrink-0 text-gray-300 hover:text-gray-500 text-xl leading-none
                    self-start transition"
            >
                ×
            </button>
        </div>
    );
}
