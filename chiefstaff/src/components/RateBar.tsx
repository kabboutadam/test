/** A horizontal rate bar: 4px rounded data-end, square at the baseline, value at the tip. */
export function RateBar({ rate, label, detail }: { rate: number; label: string; detail?: string }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="rate">
      <div className="rate-head">
        <span className="rate-label">{label}</span>
        <span className="rate-value">{pct}%</span>
      </div>
      <div className="rate-track" role="img" aria-label={`${label}: ${pct}%`}>
        <div className="rate-fill" style={{ width: `${pct}%` }} />
      </div>
      {detail && <div className="rate-detail">{detail}</div>}
    </div>
  );
}
