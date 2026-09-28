import { AlertTriangle, Inbox, RotateCw } from "lucide-react";

export function Loading({ label = "Loading..." }) {
  return (
    <div className="state state-loading" role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ title = "Unable to load this section.", message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon"><AlertTriangle size={22} /></div>
      <h3>{title}</h3>
      <p>{message || "Please try again."}</p>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          <RotateCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message = "Nothing here yet.", icon: Icon = Inbox, action }) {
  return (
    <div className="state state-empty">
      <div className="state-icon"><Icon size={22} /></div>
      {title && <h3>{title}</h3>}
      <p>{message}</p>
      {action}
    </div>
  );
}

export function NotAvailable({ endpoint, note }) {
  return (
    <EmptyState
      title="Not available yet"
      message={`The backend doesn't currently expose ${endpoint}.${note ? ` ${note}` : ""}`}
    />
  );
}

/** Placeholder blocks shown while data loads. */
export function Skeleton({ width = "100%", height = 14, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}

export function SkeletonCards({ count = 3, label = "Loading..." }) {
  return (
    <div className="grid grid-auto" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div className="card skeleton-card" key={i}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="35%" />
          <Skeleton height={8} />
          <Skeleton width="80%" />
          <Skeleton width="60%" />
        </div>
      ))}
    </div>
  );
}

/** Wraps the loading / error / content switch every data section needs. */
export function AsyncSection({ state, loadingLabel, skeleton, children }) {
  if (state.loading) return skeleton || <Loading label={loadingLabel} />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  return children(state.data);
}
