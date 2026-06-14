export interface Stat {
  label: string;
  value: string | number;
  tone?: 'default' | 'warn' | 'good';
}

const TONE: Record<NonNullable<Stat['tone']>, string> = {
  default: 'border-gray-200',
  warn: 'border-red-300 bg-red-50',
  good: 'border-emerald-300 bg-emerald-50',
};

export function StatCard({ label, value, tone = 'default' }: Stat) {
  return (
    <div className={`rounded-lg border bg-white p-5 shadow-sm ${TONE[tone]}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
