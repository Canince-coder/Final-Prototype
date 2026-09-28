/** Thin, consistently-styled wrappers around recharts. All responsive, all with tooltips. */
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const SERIES = ["#c4501a", "#2b64a8", "#1d7f47", "#d4a03a", "#8a6f5a", "#7d8fa6", "#b35c8a"];
const AXIS = { fontSize: 12, fill: "#6f685f" };
const GRID = "#ece6dc";

function Tip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <div className="t">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} style={{ color: p.color || p.payload?.fill }}>
          {p.name}: <b>{typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}{unit}</b>
        </div>
      ))}
    </div>
  );
}

/** bars: [{key, name, color?}] */
export function BarChartBox({ data, xKey, bars, height = 280, unit, stacked, horizontal }) {
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: horizontal ? 8 : -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={xKey} tick={AXIS} width={110} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 56 : 30} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip content={<Tip unit={unit} />} cursor={{ fill: "rgba(196,80,26,0.06)" }} />
          {bars.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color || SERIES[i]} radius={stacked ? 0 : [5, 5, 5, 5]} stackId={stacked ? "s" : undefined} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChartBox({ data, xKey, lines, height = 260, unit }) {
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip unit={unit} />} />
          {lines.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {lines.map((l, i) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color || SERIES[i]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** data: [{name, value, color?}] */
export function DonutChart({ data, height = 220, centerLabel, centerSub }) {
  return (
    <div className="chart" style={{ height, position: "relative" }}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip content={<Tip />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={d.name} fill={d.color || SERIES[i % SERIES.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="ring-label" style={{ pointerEvents: "none" }}>
          <span className="ring-num" style={{ fontSize: 22 }}>{centerLabel}</span>
          {centerSub && <span className="ring-sub">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}

export function DonutLegend({ data }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {data.map((d, i) => (
        <div className="row-between small" key={d.name}>
          <span className="row" style={{ gap: 8 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: d.color || SERIES[i % SERIES.length], display: "inline-block" }} />
            {d.name}
          </span>
          <b>{Math.round((d.value / total) * 100)}%</b>
        </div>
      ))}
    </div>
  );
}

/** data: [{axis, value}] with values on a 0..max scale */
export function RadarBox({ data, max = 5, height = 260, name = "Score" }) {
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#4a453e" }} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Tooltip content={<Tip />} />
          <Radar name={name} dataKey="value" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.18} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
