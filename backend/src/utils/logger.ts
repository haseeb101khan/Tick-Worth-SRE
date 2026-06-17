// Lightweight structured logger. Every line is timestamped + level-tagged so logs are
// greppable and parseable. Swap for pino later if a log pipeline is added.
const ts = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => console.log(ts(), '[info]', ...args),
  warn: (...args: unknown[]) => console.warn(ts(), '[warn]', ...args),
  error: (...args: unknown[]) => console.error(ts(), '[error]', ...args),
};

// Audit trail for security-relevant events (logins, registrations, order changes, …).
// Emits a single structured line so it can be filtered with `grep '[audit]'`.
export function audit(event: string, meta: Record<string, unknown> = {}) {
  console.log(ts(), '[audit]', event, JSON.stringify(meta));
}
