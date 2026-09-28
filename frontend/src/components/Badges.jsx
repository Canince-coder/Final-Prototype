const STATUS_STEPS = ["APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED"];
const STATUS_COLORS = {
  APPLIED: "badge-blue",
  SHORTLISTED: "badge-indigo",
  INTERVIEW: "badge-orange",
  SELECTED: "badge-green",
  REJECTED: "badge-red",
  WITHDRAWN: "badge-gray",
};

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_COLORS[status] || "badge-gray"}`}>{status}</span>;
}

export function StatusTimeline({ status }) {
  if (status === "REJECTED" || status === "WITHDRAWN") {
    return (
      <div className="timeline timeline-terminal">
        <StatusBadge status={status} />
      </div>
    );
  }
  const currentIndex = STATUS_STEPS.indexOf(status);
  return (
    <div className="timeline">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className={`timeline-step ${i <= currentIndex ? "done" : ""}`}>
          <div className="timeline-dot" />
          <span>{step}</span>
          {i < STATUS_STEPS.length - 1 && <div className="timeline-line" />}
        </div>
      ))}
    </div>
  );
}

export function MatchBadge({ percentage }) {
  let label = "Low Match";
  let cls = "match-low";
  if (percentage >= 85) {
    label = "Excellent Match";
    cls = "match-excellent";
  } else if (percentage >= 65) {
    label = "Good Match";
    cls = "match-good";
  } else if (percentage >= 40) {
    label = "Fair Match";
    cls = "match-fair";
  }
  return (
    <div className={`match-badge ${cls}`}>
      <span className="match-pct">{percentage}%</span>
      <span className="match-label">{label}</span>
    </div>
  );
}
