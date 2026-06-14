import { useEffect, useRef, useState } from 'react';
import { AppNotification } from '../types';
import { getNotifications, markNotificationRead } from '../services/notificationService';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      setNotifications(await getNotifications());
    } catch {
      // Non-critical — ignore fetch failures here.
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  async function handleRead(n: AppNotification) {
    if (n.read) return;
    const updated = await markNotificationRead(n.id);
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? updated : x)));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded bg-white/10 px-3 py-1 hover:bg-white/20"
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border bg-white text-gray-900 shadow-xl">
          {notifications.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No notifications.</p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleRead(n)}
              className={`block w-full border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-gray-50 ${
                n.read ? 'text-gray-500' : 'bg-amber-50 font-medium'
              }`}
            >
              <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                {n.type.replace('_', ' ')} · {new Date(n.createdAt).toLocaleString()}
              </span>
              {n.message}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
