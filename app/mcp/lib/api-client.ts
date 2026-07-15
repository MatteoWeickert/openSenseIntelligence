const BASE_URL =
  process.env.OSEM_API_URL || "https://staging.opensensemap.org/api";

export interface ApiRequestOptions {
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  method?: "GET" | "POST";
  body?: unknown;
  timeout?: number;
}

export async function osemFetch<T = unknown>(
  options: ApiRequestOptions
): Promise<T> {
  const { path, params, method = "GET", body, timeout = 15000 } = options;

  // Concatenate base + path to avoid URL resolution stripping base path segments
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${suffix}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `API error ${res.status}: ${res.statusText}${text ? ` — ${text}` : ""}`
      );
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function getBaseUrl(): string {
  return BASE_URL;
}
