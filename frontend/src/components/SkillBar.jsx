export default function SkillBar({ name, have, need, required = true }) {
  const max = Math.max(have, need, 1);
  const pct = Math.min(100, Math.round((have / max) * 100));
  const met = have >= need;
  return (
    <div className="skillbar">
      <div className="skillbar-head">
        <span className="skillbar-name">
          {name} {!required && <span className="skillbar-optional">(optional)</span>}
        </span>
        <span className={`skillbar-status ${met ? "met" : "gap"}`}>
          {met ? "MATCHED" : `Need +${need - have}`}
        </span>
      </div>
      <div className="skillbar-track">
        <div
          className={`skillbar-fill ${met ? "met" : "gap"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="skillbar-levels">
        {have}/{need}
      </div>
    </div>
  );
}
