# MCP Server Architecture – openSenseIntelligence

## Overview

The openSenseIntelligence MCP (Model Context Protocol) server provides AI assistants (ChatGPT, Claude, VS Code Copilot) with structured access to environmental sensor data from the openSenseMap platform. It implements the MCP specification as a stateless HTTP endpoint.

---

## Directory Structure

```
app/mcp/
├── router.ts              # Express router – HTTP endpoint
├── server.ts              # MCP server factory – registers all tools
├── lib/
│   ├── api-client.ts      # HTTP client for openSenseMap Staging API
│   ├── archive-client.ts  # HTTP client for openSenseMap Archive
│   ├── exports.ts         # File export system (CSV/JSON)
│   └── summarize.ts       # Statistical analysis & downsampling
└── tools/
    ├── search-boxes.ts           # Tool: search_boxes
    ├── get-box-info.ts           # Tool: get_box_info
    ├── get-sensor-data.ts        # Tool: get_sensor_data
    ├── get-platform-stats.ts     # Tool: get_platform_stats
    ├── archive-get-box-data.ts   # Tool: archive_get_box_data
    ├── archive-get-sensor-data.ts# Tool: archive_get_sensor_data
    ├── opensensemap-api.ts       # Tool: opensensemap_api
    └── export-data.ts            # Tool: export_data
```

---

## Entry Point & Routing

### `server.ts` (Root)

The Express server mounts the MCP router:

```typescript
import { mcpRouter } from "./app/mcp/router";
app.use("/mcp", mcpRouter);
```

This makes the MCP endpoint available at `POST /mcp` in both development and production.

### `app/mcp/router.ts`

The Express router handles three endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/mcp` | Main MCP protocol endpoint (JSON-RPC) |
| `GET` | `/mcp/exports/:id/:filename` | File download for exported data |
| `GET` | `/mcp` | Returns 405 (method not allowed) |
| `DELETE` | `/mcp` | Returns 405 (session mgmt disabled) |

**Request lifecycle for `POST /mcp`:**

1. Creates a new `McpServer` instance via `createMcpServer()`
2. Creates a `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` (stateless mode)
3. Connects server to transport
4. Delegates request handling to `transport.handleRequest(req, res, req.body)`
5. On connection close: transport and server are destroyed

```typescript
mcpRouter.post("/", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

**Key design decision:** Every request creates a fresh server instance. No sessions, no state between requests. This simplifies deployment but means AI clients must re-discover tools per conversation.

---

## MCP Server (`app/mcp/server.ts`)

Factory function that creates and configures an `McpServer` instance with all tools:

```typescript
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "openSenseIntelligence",
    version: "1.0.0",
  });
  // Register all tools in priority layers
  searchBoxes(server);           // Layer 1
  registerGetBoxInfo(server);    // Layer 1
  registerGetSensorData(server); // Layer 1
  registerGetPlatformStats(server); // Layer 1
  registerArchiveGetBoxData(server);    // Layer 2
  registerArchiveGetSensorData(server); // Layer 2
  registerOpensensemapApi(server);      // Layer 3
  registerExportData(server);           // Layer 4
  return server;
}
```

---

## Tools (8 registered)

### Layer 1: Staging API (primary data source)

#### `search_boxes`
**Purpose:** Find senseBox stations by name, location, exposure, or grouptag.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string? | Partial name match |
| `near` | string? | `"lat,lng"` for proximity search |
| `maxDistance` | number? | Max meters from `near` (default: 100,000) |
| `bbox` | string? | Bounding box `"lonSW,latSW,lonNE,latNE"` |
| `exposure` | enum? | `indoor`, `outdoor`, `mobile`, `unknown` |
| `grouptag` | string? | Group tag filter |
| `limit` | number? | Max results (default/max: 20) |

**Logic:**
- Calls `GET /boxes` with `minimal=true`
- If `near` is provided: calculates Haversine distance for each result, filters by `maxDistance`, sorts by distance
- Returns formatted list with ID, name, location, exposure, and distance

---

#### `get_box_info`
**Purpose:** Get detailed information about a specific senseBox including all sensors and their last measurements.

| Parameter | Type | Description |
|-----------|------|-------------|
| `boxId` | string | The senseBox ID |

**Logic:**
- Calls `GET /boxes/{boxId}`
- Formats response with: name, exposure, model, location, creation date
- Lists all sensors with: title, unit, type, last measurement value + timestamp

---

#### `get_sensor_data`
**Purpose:** Retrieve time-series measurements from a specific sensor with statistical summary.

| Parameter | Type | Description |
|-----------|------|-------------|
| `boxId` | string | The senseBox ID |
| `sensorId` | string | The sensor ID |
| `fromDate` | string? | ISO date start (default: 24h ago) |
| `toDate` | string? | ISO date end (default: now) |

**Logic:**
- Calls `GET /boxes/{boxId}/data/{sensorId}` with date range
- Applies LTTB downsampling to max 50 points
- Calculates summary statistics (min, max, mean, stddev, trend)
- Returns formatted text with summary + data points table

---

#### `get_platform_stats`
**Purpose:** Get platform-wide statistics.

| Parameter | Type | Description |
|-----------|------|-------------|
| *(none)* | | |

**Logic:**
- Calls `GET /stats` (returns array: `[boxes, measurements, measurementsPerMinute]`)
- Formats as human-readable text

---

### Layer 2: Archive (historical data)

#### `archive_get_box_data`
**Purpose:** Get historical data overview for a box from the archive.

| Parameter | Type | Description |
|-----------|------|-------------|
| `boxId` | string | The senseBox ID |
| `date` | string | Date in `YYYY-MM-DD` format |

**Logic:**
- Fetches box info from staging API to get the box name
- Resolves archive slug (handles ID/name mismatches between staging and archive)
- Fetches JSON metadata from archive
- Returns sensor list with available data for that date

---

#### `archive_get_sensor_data`
**Purpose:** Retrieve detailed historical measurements for a specific sensor.

| Parameter | Type | Description |
|-----------|------|-------------|
| `boxId` | string | The senseBox ID |
| `sensorId` | string | The sensor ID |
| `from` | string | Start date `YYYY-MM-DD` |
| `to` | string | End date `YYYY-MM-DD` |

**Logic:**
- Fetches box name from staging API
- Iterates over date range, fetching CSV files from archive per day
- Applies slug resolution with fallback strategies
- Concatenates results, applies downsampling + summary
- Returns formatted text with stats + data points

---

### Layer 3: Generic API Fallback

#### `opensensemap_api`
**Purpose:** Generic access to any openSenseMap API endpoint (fallback for edge cases).

| Parameter | Type | Description |
|-----------|------|-------------|
| `endpoint` | string | API path (e.g. `/boxes`, `/stats`) |
| `method` | enum? | `GET` or `POST` (default: GET) |
| `params` | string? | JSON string of query params |
| `body` | string? | JSON string of request body |

**Logic:**
- Parses params/body from JSON strings
- Calls `osemFetch()` with the given endpoint
- Returns raw JSON response as formatted text

---

### Layer 4: Data Export

#### `export_data`
**Purpose:** Export measurement data as a downloadable CSV or JSON file.

| Parameter | Type | Description |
|-----------|------|-------------|
| `boxId` | string | The senseBox ID |
| `sensorId` | string | The sensor ID |
| `format` | enum? | `csv` or `json` (default: csv) |
| `fromDate` | string? | Start date (default: 24h ago) |
| `toDate` | string? | End date (default: now) |

**Logic:**
- Fetches measurements from staging API
- Writes data to filesystem (`./mcp-exports/`) with random ID
- Returns download URL (`/mcp/exports/:id/:filename`)
- Files auto-expire after 1 hour

---

## Libraries (`app/mcp/lib/`)

### `api-client.ts`

HTTP client wrapper for the openSenseMap Staging API.

- **Base URL:** `process.env.OSEM_API_URL` or `https://staging.opensensemap.org/api`
- **Function:** `osemFetch<T>({ path, params, method, body, timeout })`
- Handles URL construction, query params, abort controller timeout (default: 15s)
- Throws on non-OK responses with status code

---

### `archive-client.ts`

HTTP client for the openSenseMap Archive (daily CSV/JSON dumps).

- **Base URL:** `process.env.OSEM_ARCHIVE_URL` or `https://archive.opensensemap.org`
- **URL pattern:** `/{date}/{boxId}-{normalizedName}/{sensorId}-{date}.csv`

**Key functions:**

| Function | Purpose |
|----------|---------|
| `fetchBoxMeta()` | Direct metadata fetch by ID + name |
| `fetchSensorCsv()` | Direct CSV fetch by sensor ID |
| `resolveBoxSlugFromListing()` | Resolves slug from directory listing |
| `fetchBoxMetaWithFallback()` | Meta fetch with slug resolution fallback |
| `fetchSensorCsvWithFallback()` | CSV fetch with slug + sensor ID resolution |
| `fetchSensorDataRange()` | Batch fetch across date range with concurrency control |

**Slug resolution strategies (3-level fallback):**
1. **ID match** – regex match for `{boxId}-...` in directory listing
2. **Exact name match** – match by normalized box name
3. **Fuzzy skeleton match** – strip all non-alphanumeric chars, compare lowercase

This handles the common case where staging and production use different box IDs but the same name.

---

### `summarize.ts`

Statistical analysis and data reduction.

**`summarizeMeasurements(data)`** returns:
- `count`, `min`, `max`, `mean`, `stddev`
- `trend`: compares first-third average vs last-third average → `"rising"` / `"falling"` / `"stable"`
- `firstTimestamp`, `lastTimestamp`

**`downsample(data, maxPoints)`** – LTTB-like algorithm:
- Keeps first and last points
- Evenly samples remaining points to reduce data volume

---

### `exports.ts`

File export system for downloadable data.

- **Storage:** `./mcp-exports/` directory
- **TTL:** 1 hour (auto-cleanup)
- **Formats:** CSV (with proper escaping) and JSON
- **Registry:** In-memory `Map<id, ExportMeta>` tracking active exports
- **URL pattern:** `/mcp/exports/{id}/{filename}`

---

## External API Dependencies

| Service | URL | Usage |
|---------|-----|-------|
| openSenseMap Staging API | `https://staging.opensensemap.org/api` | Live box data, search, sensors, measurements |
| openSenseMap Archive | `https://archive.opensensemap.org` | Historical daily data dumps (CSV + JSON metadata) |

---

## Frontend Integration

The MCP server is presented to users via:

1. **MCP Info Overlay** (`app/components/header/mcp-info.tsx`) – Dialog on the Explore page showing:
   - Server URL with copy button
   - Expandable list of 8 available tools
   - Setup instructions for ChatGPT, Claude, and VS Code Copilot

2. **MCP Pill Button** in MapHeader (`app/components/map/topbar.tsx`) – triggers the overlay

---

## Protocol Details

- **Transport:** StreamableHTTP (MCP SDK v1.29+)
- **Session Management:** Disabled (stateless)
- **Serialization:** JSON-RPC 2.0
- **Authentication:** None required
- **Tool Schema Format:** Zod → JSON Schema (auto-converted by MCP SDK)

---
