const COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-blue-100 text-blue-800',
  DISPATCHED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-200 text-gray-600',
  REPORTED: 'bg-amber-100 text-amber-800',
  IN_REPAIR: 'bg-blue-100 text-blue-800',
  REPAIRED: 'bg-emerald-100 text-emerald-800',
  SCRAPPED: 'bg-gray-200 text-gray-600',
  OPEN: 'bg-amber-100 text-amber-800',
  AVAILABLE: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-gray-200 text-gray-600',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
};

// `label` overrides the displayed text (e.g. a friendly "Ordered" for PENDING) while
// the colour still keys off the raw status.
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status] ?? 'bg-gray-100'}`}>
      {label ?? status.replace('_', ' ')}
    </span>
  );
}
