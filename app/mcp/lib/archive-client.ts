const ARCHIVE_BASE_URL =
  process.env.OSEM_ARCHIVE_URL || "https://archive.opensensemap.org";

export interface ArchiveBoxMeta {
  name: string;
  id: string;
  boxType?: string;
  exposure: string | null;
  model: string | null;
  loc?: {
    geometry: {
      coordinates: [number, number];
      type: string;
    };
  };
  locations?: Array<{
    type: string;
    coordinates: [number, number];
  }>;
  longitude?: number;
  latitude?: number;
  sensors: ArchiveSensor[];
}

export interface ArchiveSensor {
  title: string;
  unit: string;
  sensorType: string;
  id: string;
  _id?: string;
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
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reduce a string to its lowercase alphanumeric skeleton for fuzzy comparison.
 * Strips all non-alphanumeric chars (underscores, spaces, unicode) so that
 * "Waldschlößchen", "Waldschl__sschen", "Waldschl_sschen" all become "waldschlsschen".
 */
function toAlphanumSkeleton(str: string): string {
  return str.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/**
 * Extract coordinates [lat, lng] from archive metadata (handles different formats).
 */
export function getArchiveCoordinates(meta: ArchiveBoxMeta): [number, number] | null {
  if (meta.loc?.geometry?.coordinates) {
    return [meta.loc.geometry.coordinates[1], meta.loc.geometry.coordinates[0]];
  }
  if (meta.locations?.[0]?.coordinates) {
    return [meta.locations[0].coordinates[1], meta.locations[0].coordinates[0]];
  }
  if (meta.latitude !== undefined && meta.longitude !== undefined) {
    return [meta.latitude, meta.longitude];
  }
  return null;
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
 * Try to resolve the box slug by fetching the day listing and matching by ID or name.
 * First tries matching by box ID prefix. If that fails, tries matching by normalized box name.
 */
export async function resolveBoxSlugFromListing(
  boxId: string,
  date: string,
  boxName?: string,
  timeout = 15000
): Promise<string | null> {
  const url = `${ARCHIVE_BASE_URL}/${date}/`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const html = await res.text();

    // Strategy 1: Match by staging box ID
    const idRegex = new RegExp(
      `<a\\s+href="\\.\\/(${boxId}-[^"]*?)\\/"`,
      "i"
    );
    const idMatch = html.match(idRegex);
    if (idMatch) return idMatch[1];

    // Strategy 2: Match by box name (handles different IDs between staging/production)
    if (boxName) {
      const normalized = normalizeBoxName(boxName);
      // Try exact normalized name match (case-insensitive)
      const nameRegex = new RegExp(
        `<a\\s+href="\\.\\/([^"]*?-${escapeRegex(normalized)})\\/"`,
        "i"
      );
      const nameMatch = html.match(nameRegex);
      if (nameMatch) return nameMatch[1];

      // Try without spaces/underscores (e.g. "Green Guard" -> "GreenGuard")
      const compactName = boxName.replace(/\s+/g, "");
      const compactRegex = new RegExp(
        `<a\\s+href="\\.\\/([^"]*?-${escapeRegex(compactName)})\\/"`,
        "i"
      );
      const compactMatch = html.match(compactRegex);
      if (compactMatch) return compactMatch[1];

      // Strategy 3: Fuzzy match — collapse underscores and compare alphanumeric skeleton
      // Handles different unicode normalization (e.g. ö→"__" vs ö→"_")
      const skeleton = toAlphanumSkeleton(boxName);
      if (skeleton.length >= 3) {
        const allLinks = [...html.matchAll(/<a\s+href="\.\/([^"]+?)\/">/gi)];
        for (const link of allLinks) {
          const slug = link[1];
          // Extract name part after the ID prefix (ID-Name format)
          const dashIdx = slug.indexOf("-");
          if (dashIdx === -1) continue;
          const namePart = slug.slice(dashIdx + 1);
          if (toAlphanumSkeleton(namePart) === skeleton) {
            return slug;
          }
        }
      }
    }

    return null;
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

  // Fallback: resolve actual slug from directory listing (by ID or name)
  const slug = await resolveBoxSlugFromListing(boxId, date, boxName);
  if (!slug) return null;

  // Try multiple filename patterns (archive uses inconsistent naming)
  const candidates = [
    `${slug}-${date}.json`,                        // full slug as filename
    `${normalizeBoxName(boxName)}-${date}.json`,   // just normalized name
    `${boxName.replace(/\s+/g, "")}-${date}.json`, // compact name (no spaces)
  ];

  for (const filename of candidates) {
    const url = `${ARCHIVE_BASE_URL}/${date}/${slug}/${filename}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        return (await res.json()) as ArchiveBoxMeta;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Fetch sensor CSV with fallback slug resolution.
 * If the slug was resolved by name (different archive ID), it also resolves
 * sensor IDs by fetching the archive metadata and matching sensors by title.
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

  // Fallback: resolve slug (by ID or name)
  const slug = await resolveBoxSlugFromListing(boxId, date, boxName);
  if (!slug) return null;

  // Check if the resolved slug uses a different box ID (production vs staging)
  const archiveBoxId = slug.split("-")[0];
  let targetSensorId = sensorId;

  if (archiveBoxId !== boxId) {
    // Different IDs: need to resolve sensor ID via metadata
    // Try multiple filename patterns for the metadata JSON
    const metaCandidates = [
      `${slug}-${date}.json`,
      `${normalizeBoxName(boxName)}-${date}.json`,
      `${boxName.replace(/\s+/g, "")}-${date}.json`,
    ];

    let meta: ArchiveBoxMeta | null = null;
    for (const metaFilename of metaCandidates) {
      const metaUrl = `${ARCHIVE_BASE_URL}/${date}/${slug}/${metaFilename}`;
      try {
        const metaRes = await fetch(metaUrl);
        if (metaRes.ok) {
          meta = (await metaRes.json()) as ArchiveBoxMeta;
          break;
        }
      } catch {
        continue;
      }
    }

    if (meta) {
      // Try to find the archive sensor by matching title with staging sensor info
      const archiveSensorIds = meta.sensors.map((s) => s._id ?? s.id);
      // Try the sensorId directly first
      const directFilename = `${sensorId}-${date}.csv`;
      const directUrl = `${ARCHIVE_BASE_URL}/${date}/${slug}/${directFilename}`;
      try {
        const directRes = await fetch(directUrl);
        if (directRes.ok) {
          const text = await directRes.text();
          return parseCsv(text);
        }
      } catch {
        // continue
      }
      // Sensor ID doesn't match — try all archive sensors
      // (callers should use archive_get_box_data to discover proper sensor IDs)
      for (const archiveSensor of archiveSensorIds) {
        if (archiveSensor) {
          targetSensorId = archiveSensor;
          break;
        }
      }
    }
  }

  const filename = `${targetSensorId}-${date}.csv`;
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
