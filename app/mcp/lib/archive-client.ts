const ARCHIVE_BASE_URL =
  process.env.OSEM_ARCHIVE_URL || "https://archive.opensensemap.org";

export interface ArchiveBoxMeta {
  name: string;
  id: string;
  boxType: string;
  exposure: string | null;
  model: string | null;
  loc: {
    geometry: {
      coordinates: [number, number];
      type: string;
    };
  };
  sensors: ArchiveSensor[];
}

export interface ArchiveSensor {
  title: string;
  unit: string;
  sensorType: string;
  id: string;
}

export interface ArchiveMeasurement {
  createdAt: string;
  value: string;
}

/**
 * Normalize a box name for use in archive URLs (same logic as archive-link.ts).
 */
function normalizeBoxName(name: string): string {
  return name.replace(/[\u00A0-\u10FFFF]/g, "__").replace(/[^A-Za-z0-9._-]/g, "_");
}

/**
 * Build the archive URL slug for a box on a given date.
 */
export function buildBoxSlug(boxId: string, boxName: string): string {
  return `${boxId}-${normalizeBoxName(boxName)}`;
}

/**
 * Format a Date as YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Generate an array of date strings (YYYY-MM-DD) for a range (inclusive).
 */
export function getDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  if (start > end) return [];

  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Fetch the JSON metadata for a box on a given date.
 * Returns null if not found.
 */
export async function fetchBoxMeta(
  boxId: string,
  boxName: string,
  date: string,
  timeout = 15000
): Promise<ArchiveBoxMeta | null> {
  const slug = buildBoxSlug(boxId, boxName);
  const filename = `${slug}-${date}.json`;
  const url = `${ARCHIVE_BASE_URL}/${date}/${slug}/${filename}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as ArchiveBoxMeta;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch CSV data for a specific sensor on a given date.
 * Returns parsed measurements or null if not available.
 */
export async function fetchSensorCsv(
  boxId: string,
  boxName: string,
  sensorId: string,
  date: string,
  timeout = 15000
): Promise<ArchiveMeasurement[] | null> {
  const slug = buildBoxSlug(boxId, boxName);
  const filename = `${sensorId}-${date}.csv`;
  const url = `${ARCHIVE_BASE_URL}/${date}/${slug}/${filename}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    return parseCsv(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse archive CSV format into measurements.
 * Expected format: createdAt,value (with or without header).
 */
function parseCsv(raw: string): ArchiveMeasurement[] {
  const lines = raw.trim().split("\n");
  if (lines.length === 0) return [];

  const results: ArchiveMeasurement[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip header line
    if (trimmed.startsWith("createdAt") || trimmed.startsWith("timestamp")) continue;

    const commaIdx = trimmed.indexOf(",");
    if (commaIdx === -1) continue;

    const createdAt = trimmed.slice(0, commaIdx);
    const value = trimmed.slice(commaIdx + 1);
    if (createdAt && value) {
      results.push({ createdAt, value });
    }
  }
  return results;
}

/**
 * Try to resolve the box slug by fetching the day listing and matching by ID prefix.
 * Useful when the exact box name normalization is unknown.
 */
export async function resolveBoxSlugFromListing(
  boxId: string,
  date: string,
  timeout = 15000
): Promise<string | null> {
  const url = `${ARCHIVE_BASE_URL}/${date}/`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const html = await res.text();

    // Parse directory listing links: <a href="./BOXID-NAME/">
    const regex = new RegExp(
      `<a\\s+href="\\.\\/(${boxId}-[^"]*?)\\/"`,
      "i"
    );
    const match = html.match(regex);
    return match ? match[1] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch box metadata with fallback: try direct URL first, then resolve slug from listing.
 */
export async function fetchBoxMetaWithFallback(
  boxId: string,
  boxName: string,
  date: string
): Promise<ArchiveBoxMeta | null> {
  // Try direct path first
  const meta = await fetchBoxMeta(boxId, boxName, date);
  if (meta) return meta;

  // Fallback: resolve actual slug from directory listing
  const slug = await resolveBoxSlugFromListing(boxId, date);
  if (!slug) return null;

  // Fetch JSON using resolved slug
  const filename = `${slug}-${date}.json`;
  const url = `${ARCHIVE_BASE_URL}/${date}/${slug}/${filename}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as ArchiveBoxMeta;
  } catch {
    return null;
  }
}

/**
 * Fetch sensor CSV with fallback slug resolution.
 */
export async function fetchSensorCsvWithFallback(
  boxId: string,
  boxName: string,
  sensorId: string,
  date: string
): Promise<ArchiveMeasurement[] | null> {
  // Try direct path
  const data = await fetchSensorCsv(boxId, boxName, sensorId, date);
  if (data) return data;

  // Fallback: resolve slug
  const slug = await resolveBoxSlugFromListing(boxId, date);
  if (!slug) return null;

  const filename = `${sensorId}-${date}.csv`;
  const url = `${ARCHIVE_BASE_URL}/${date}/${slug}/${filename}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return parseCsv(text);
  } catch {
    return null;
  }
}

/**
 * Batch-fetch sensor data across multiple dates with concurrency control.
 */
export async function fetchSensorDataRange(
  boxId: string,
  boxName: string,
  sensorId: string,
  dates: string[],
  concurrency = 10
): Promise<{ date: string; measurements: ArchiveMeasurement[] | null }[]> {
  const results: { date: string; measurements: ArchiveMeasurement[] | null }[] = [];

  for (let i = 0; i < dates.length; i += concurrency) {
    const batch = dates.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (date) => ({
        date,
        measurements: await fetchSensorCsvWithFallback(boxId, boxName, sensorId, date),
      }))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({ date: batch[batchResults.indexOf(result)], measurements: null });
      }
    }
  }

  return results;
}
