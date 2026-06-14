import { displayName } from "@/lib/graph/utils";
import type { GraphSearchResult } from "@/lib/graph/schema";
import { cn } from "@/lib/utils";

interface GraphCanvasProps {
  result: GraphSearchResult;
  className?: string;
}

export function GraphCanvas({ result, className }: GraphCanvasProps) {
  const width = 760;
  const height = 440;
  const center = { x: width / 2, y: height / 2 };
  const neighbors = result.nodes.filter((node) => node.custId !== result.custId);
  const radius = Math.min(width, height) * 0.36;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(result.custId, center);
  neighbors.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(neighbors.length, 1) - Math.PI / 2;
    positions.set(node.custId, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  });

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-muted/20", className)}>
      <svg
        role="img"
        aria-label="Customer relationship graph"
        viewBox={`0 0 ${width} ${height}`}
        className="aspect-[19/11] w-full"
      >
        <rect width={width} height={height} fill="var(--card)" />
        {result.edges.map((edge) => {
          const source = positions.get(result.custId) ?? center;
          const target = positions.get(edge.neighborCustId);
          if (!target) {
            return null;
          }
          return (
            <g key={edge.edgeId}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={edge.strength === "Strong" ? "var(--primary)" : "var(--chart-3)"}
                strokeDasharray={edge.strength === "Weak" ? "7 7" : undefined}
                strokeOpacity={0.75}
                strokeWidth={edge.strength === "Strong" ? 2.5 : 1.8}
              />
            </g>
          );
        })}
        {result.nodes.map((node) => {
          const point = positions.get(node.custId);
          if (!point) {
            return null;
          }
          const isCenter = node.custId === result.custId;
          const fill = node.isSanctioned
            ? "var(--destructive)"
            : node.isHighRisk
              ? "var(--chart-4)"
              : isCenter
                ? "var(--primary)"
                : "var(--secondary)";
          return (
            <g key={node.custId}>
              <title>{`${node.custId} ${displayName(node)} ${node.riskLevel}`}</title>
              <circle
                cx={point.x}
                cy={point.y}
                r={isCenter ? 34 : 25}
                fill={fill}
                stroke="var(--background)"
                strokeWidth="5"
              />
              <text
                x={point.x}
                y={point.y + 4}
                textAnchor="middle"
                className={cn(
                  "text-[13px] font-semibold",
                  isCenter || node.isHighRisk ? "fill-primary-foreground" : "fill-foreground"
                )}
              >
                {node.custId.slice(-4)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
