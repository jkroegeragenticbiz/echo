import type { KeyMetric } from "@echo/core";

export function MetricPill({ metric }: { metric: KeyMetric }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full whitespace-nowrap border border-line bg-card px-2.5 py-1 text-[0.78rem]">
      <span className="text-muted">{metric.label}</span>
      <span className="font-semibold text-ink tabular-nums">{metric.value}</span>
    </span>
  );
}
