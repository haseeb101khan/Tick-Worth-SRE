import { useEffect, useState } from 'react';
import { FullReport, ReportPreview } from '../../types';
import { getMyReports, getReportPreview, sendReportToOwner } from '../../services/reportService';
import { downloadReport } from '../../utils/report';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { ReportDetail } from './ReportDetail';

/**
 * Shopkeeper / warehouse: preview the report they're about to send (everything since their
 * last one), send it as a frozen snapshot, and review/download their past reports.
 */
export function SendReportPanel() {
  const toast = useToast();
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [history, setHistory] = useState<FullReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  function refresh() {
    Promise.all([getReportPreview(), getMyReports()])
      .then(([p, h]) => {
        setPreview(p);
        setHistory(h);
      })
      .catch((e) => toast.error(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function send() {
    setBusy(true);
    try {
      const report = await sendReportToOwner();
      toast.success(`Sent to owner — ${report.title}`);
      refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading report…</p>;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Report to send</h3>
            {preview && (
              <p className="text-sm text-gray-500">
                {preview.title} · covers {fmt(preview.periodStart)} – {fmt(preview.periodEnd)}{' '}
                <span className="text-gray-400">(everything since your last report)</span>
              </p>
            )}
          </div>
          <button
            onClick={send}
            disabled={busy}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? 'Sending…' : '📨 Send to owner'}
          </button>
        </div>
        {preview && <ReportDetail kind={preview.kind} data={preview.data} />}
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Your sent reports ({history.length})</h3>
        {history.length === 0 && (
          <p className="text-sm text-gray-500">You haven’t sent any reports yet.</p>
        )}
        <div className="space-y-2">
          {history.map((r) => (
            <div key={r.id} className="rounded-lg border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className="text-left"
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    sent {new Date(r.createdAt).toLocaleString()}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadReport(r)}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-100"
                  >
                    ⬇ Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-100"
                  >
                    {openId === r.id ? 'Hide' : 'View'}
                  </button>
                </div>
              </div>
              {openId === r.id && (
                <div className="border-t p-4">
                  <ReportDetail kind={r.kind} data={r.data} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
