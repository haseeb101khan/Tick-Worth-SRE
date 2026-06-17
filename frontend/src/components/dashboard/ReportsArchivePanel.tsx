import { useEffect, useState } from 'react';
import { FullReport, SentReportSummary } from '../../types';
import { deleteSentReport, getSentReport, getSentReports } from '../../services/reportService';
import { downloadReport } from '../../utils/report';
import { formatDate, formatDateTime } from '../../utils/format';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { ReportDetail } from './ReportDetail';

/**
 * Owner: archive of every report sent by staff. Each row shows who sent it, the period it
 * covers, and when it was sent. Click to load the full frozen snapshot, or download it.
 */
export function ReportsArchivePanel() {
  const toast = useToast();
  const [reports, setReports] = useState<SentReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<Record<string, FullReport>>({});

  useEffect(() => {
    getSentReports()
      .then(setReports)
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(id: string): Promise<FullReport | null> {
    if (full[id]) return full[id];
    try {
      const r = await getSentReport(id);
      setFull((prev) => ({ ...prev, [id]: r }));
      return r;
    } catch (e) {
      toast.error(apiErrorMessage(e));
      return null;
    }
  }

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    // Only expand if the snapshot actually loaded — otherwise the row would show
    // "Hide" over an empty panel and a re-click would collapse instead of retrying.
    const r = await load(id);
    if (r) setOpenId(id);
  }

  async function download(id: string) {
    const r = await load(id);
    if (r) downloadReport(r);
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This permanently removes the report and cannot be undone.`)) {
      return;
    }
    try {
      await deleteSentReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setFull((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (openId === id) setOpenId(null);
      toast.success('Report deleted');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  if (loading) return <p className="text-gray-500">Loading reports…</p>;
  if (reports.length === 0) {
    return (
      <p className="text-gray-500">
        No reports received yet. Shopkeeper and warehouse staff send these from their dashboards.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Reports sent to you by staff. Click one to see all the details, or download it.
      </p>
      {reports.map((r) => (
        <div key={r.id} className="rounded-lg border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">
                {r.title}
                <span
                  className={`ml-2 rounded px-2 py-0.5 text-xs ${
                    r.kind === 'WAREHOUSE' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {r.kind === 'WAREHOUSE' ? 'Warehouse' : 'Shop'}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                from <b>{r.senderName}</b> ({r.senderRole.replace('_', ' ')}) · covers{' '}
                {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · sent {formatDateTime(r.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => download(r.id)}
                className="rounded border px-3 py-1 text-xs hover:bg-gray-100"
              >
                ⬇ Download
              </button>
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
              >
                {openId === r.id ? 'Hide' : 'View details'}
              </button>
              <button
                type="button"
                onClick={() => remove(r.id, r.title)}
                className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
          {openId === r.id && full[r.id] && (
            <div className="border-t p-4">
              <ReportDetail kind={full[r.id].kind} data={full[r.id].data} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
