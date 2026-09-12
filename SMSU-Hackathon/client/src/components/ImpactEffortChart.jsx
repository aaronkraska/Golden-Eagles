import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
export default function ImpactEffortChart({ items, onSelect }) {
  return (
    <section className="panel matrix">
      <div className="eyebrow">THE BIG PICTURE</div>
      <h2>Impact vs. effort</h2>
      <p className="muted">
        Start at the upper left. Larger circles indicate higher risk.
      </p>
      <div
        className="chart"
        role="img"
        aria-label="Opportunity matrix: business impact versus implementation complexity"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 15, right: 20, bottom: 28, left: 6 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="#e1e7e3" />
            <XAxis
              type="number"
              dataKey="implementationComplexity"
              domain={[0, 10]}
              name="Complexity"
              label={{
                value: "Implementation complexity →",
                position: "bottom",
                offset: 8,
              }}
            />
            <YAxis
              type="number"
              dataKey="businessImpact"
              domain={[0, 10]}
              name="Impact"
              width={40}
              label={{
                value: "Business impact",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <ZAxis dataKey="risk" range={[100, 430]} domain={[0, 10]} />
            <ReferenceLine x={5} stroke="#b7c8bd" />
            <ReferenceLine y={5} stroke="#b7c8bd" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="chart-tooltip">
                    <strong>{payload[0].payload.title}</strong>
                    <p>
                      Impact {payload[0].payload.businessImpact}/10 · Complexity{" "}
                      {payload[0].payload.implementationComplexity}/10
                    </p>
                    <p>Risk {payload[0].payload.risk}/10</p>
                  </div>
                ) : null
              }
            />
            <Scatter
              data={items}
              fill="#27725e"
              onClick={(point) => onSelect(point.id)}
              style={{ cursor: "pointer" }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
