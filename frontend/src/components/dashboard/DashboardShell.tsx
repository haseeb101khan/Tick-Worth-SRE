import { ReactNode, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export interface DashboardTab {
  id: string;
  label: string;
  render: () => ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  preview?: ReactNode; // row of StatCards shown above the tabs
  tabs: DashboardTab[];
}

export function DashboardShell({ title, subtitle, preview, tabs }: Props) {
  const { user } = useAuth();
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-24 sm:px-6">
      <h1 className="font-serif text-3xl font-light text-ink">{title}</h1>
      <p className="mb-6 text-sm text-stone">
        {subtitle ?? `Signed in as ${user?.name} (${user?.role.replace('_', ' ')})`}
      </p>

      {preview && <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{preview}</div>}

      <div className="mb-6 flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              current?.id === t.id ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current?.render()}
    </main>
  );
}
