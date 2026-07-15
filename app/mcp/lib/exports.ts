import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, readdir, stat } from "node:fs/promises";
import path from "node:path";

const EXPORTS_DIR = path.resolve("./mcp-exports");
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

interface ExportMeta {
  id: string;
  filename: string;
  createdAt: number;
  format: "json" | "csv";
  records: number;
}

const exportRegistry = new Map<string, ExportMeta>();

async function ensureDir() {
  await mkdir(EXPORTS_DIR, { recursive: true });
}

export async function createExport(
  data: unknown[],
  format: "json" | "csv",
  filenameHint: string
): Promise<{ id: string; filename: string; url: string; records: number }> {
  await ensureDir();

  const id = randomBytes(12).toString("hex");
  const ext = format === "csv" ? "csv" : "json";
  const filename = `${filenameHint}-${id}.${ext}`;
  const filepath = path.join(EXPORTS_DIR, filename);

  let content: string;
  if (format === "csv") {
    content = toCsv(data as Record<string, unknown>[]);
  } else {
    content = JSON.stringify(data, null, 2);
  }

  await writeFile(filepath, content, "utf-8");

  const meta: ExportMeta = {
    id,
    filename,
    createdAt: Date.now(),
    format,
    records: data.length,
  };
  exportRegistry.set(id, meta);

  const baseUrl = process.env.MCP_EXPORT_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/mcp/exports/${id}/${filename}`;

  return { id, filename, url, records: data.length };
}

export async function getExportFile(
  id: string
): Promise<{ filepath: string; filename: string; format: string } | null> {
  const meta = exportRegistry.get(id);
  if (!meta) return null;

  if (Date.now() - meta.createdAt > MAX_AGE_MS) {
    await deleteExport(id);
    return null;
  }

  const filepath = path.join(EXPORTS_DIR, meta.filename);
  return { filepath, filename: meta.filename, format: meta.format };
}

export async function readExportFile(id: string): Promise<Buffer | null> {
  const info = await getExportFile(id);
  if (!info) return null;
  return readFile(info.filepath);
}

async function deleteExport(id: string) {
  const meta = exportRegistry.get(id);
  if (!meta) return;
  const filepath = path.join(EXPORTS_DIR, meta.filename);
  await unlink(filepath).catch(() => {});
  exportRegistry.delete(id);
}

/** Remove expired exports (call periodically) */
export async function cleanupExports() {
  const now = Date.now();
  for (const [id, meta] of exportRegistry) {
    if (now - meta.createdAt > MAX_AGE_MS) {
      await deleteExport(id);
    }
  }
}

function toCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
