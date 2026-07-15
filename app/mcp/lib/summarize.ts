export interface MeasurementPoint {
  sensor_id: string;
  time: string;
  value: number;
  location_id: string | null;
}

export interface DataSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  stddev: number;
  trend: "rising" | "falling" | "stable";
  firstTimestamp: string;
  lastTimestamp: string;
}

export function summarizeMeasurements(data: MeasurementPoint[]): DataSummary {
  if (data.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      stddev: 0,
      trend: "stable",
      firstTimestamp: "",
      lastTimestamp: "",
    };
  }

  const values = data.map((d) => d.value);
  const count = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  const stddev = Math.sqrt(variance);

  // Trend: compare first third average vs last third average
  const third = Math.max(1, Math.floor(count / 3));
  const firstThirdAvg =
    values.slice(0, third).reduce((a, b) => a + b, 0) / third;
  const lastThirdAvg =
    values.slice(-third).reduce((a, b) => a + b, 0) / third;
  const diff = lastThirdAvg - firstThirdAvg;
  const threshold = stddev * 0.25 || (max - min) * 0.1 || 0.01;

  let trend: "rising" | "falling" | "stable" = "stable";
  if (diff > threshold) trend = "rising";
  else if (diff < -threshold) trend = "falling";

  // Data comes sorted newest-first from API
  const timestamps = data.map((d) => d.time);
  const firstTimestamp = timestamps[timestamps.length - 1];
  const lastTimestamp = timestamps[0];

  return {
    count,
    min: round(min),
    max: round(max),
    mean: round(mean),
    stddev: round(stddev),
    trend,
    firstTimestamp,
    lastTimestamp,
  };
}

/**
 * Downsample data to at most `maxPoints` using LTTB-like approach
 * (picks evenly-spaced points to preserve shape).
 */
export function downsample(
  data: MeasurementPoint[],
  maxPoints: number
): MeasurementPoint[] {
  if (data.length <= maxPoints) return data;

  const step = (data.length - 2) / (maxPoints - 2);
  const result: MeasurementPoint[] = [data[0]];

  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(1 + i * step);
    result.push(data[Math.min(idx, data.length - 1)]);
  }

  result.push(data[data.length - 1]);
  return result;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
