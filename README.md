# Knowledge Graph Visualizer

A Next.js dashboard + VS Code extension that turns your codebase into a live,
navigable knowledge graph. Files become nodes, references between files become
edges. Create, update, and delete files in your editor and the graph stays in
sync. Use the graph to extract artifacts (PRD / HLD / LLD) for future
vibecoding sessions.

```
┌────────────────────────┐  HTTP sync   ┌────────────────────────────┐
│  VS Code Extension     │ ───────────▶ │  Next.js + Prisma + SQLite │
│  (file watcher +       │              │  (graph + dashboard)       │
│   import parser)       │              │                            │
└────────────────────────┘              └────────────────────────────┘
                                                       │
                                            ┌──────────┴──────────┐
                                            ▼                     ▼
                                       React Flow            PRD / HLD / LLD
                                       visualization         (stubbed today)
```

## Repository layout

```
.
├── apps/
│   ├── web/                 # Next.js 14 dashboard (App Router, Tailwind)
│   │   ├── prisma/          # SQLite schema
│   │   └── src/
│   │       ├── app/         # Pages + REST API routes
│   │       ├── components/  # Graph view, dialogs, UI primitives
│   │       └── lib/         # Prisma client, graph helpers, doc stubs
│   └── vscode-extension/    # TypeScript VS Code extension
│       └── src/             # Watcher, parser, API client, commands
├── packages/
│   └── shared/              # Types + language-agnostic parsers
│       └── src/parsers/     # JS/TS, Python, Go import extraction
├── scripts/                 # Local helper scripts
└── package.json             # npm workspaces root
```

## Quick start

### 1. Install & build

```bash
npm install
npm run build --workspace=packages/shared   # compile the shared parser
```

### 2. Initialize the database

```bash
npm run db:push --workspace=apps/web
```

This creates `apps/web/prisma/dev.db`.

### 3. Run the web app

```bash
npm run dev
```

Open <http://localhost:3000>. You should see an empty dashboard.

### 4. Install the VS Code extension

```bash
cd apps/vscode-extension
npm install
npm run watch        # compile on save
```

Then in VS Code: `Cmd+Shift+P` → "Extensions: Open Extensions Folder" for the
user, drop the `apps/vscode-extension/` folder in, and reload.

Alternatively, run `npm run package` to produce a `.vsix`, then
`Extensions: Install from VSIX`.

### 5. Register a project in VS Code

Open a folder in VS Code, then `Cmd+Shift+P` →
**Knowledge Graph: Register Current Workspace**.

This creates a project in the dashboard and triggers a full sync.

### 6. Watch the magic

Edit, create, and delete files. After a 500ms debounce, the extension
re-parses the file and pushes changes to the dashboard. The graph updates
live. Deleted files cascade — their edges are removed automatically.

## How it works

### Data model (Prisma + SQLite)

- **Project** — root for a codebase, identified by absolute path
- **File** — one row per source file, with language + content hash
- **Edge** — directed reference: `from` file → `to` file, typed by reference kind (`import`, `require`, `dynamic`)
- **Document** — generated PRD / HLD / LLD markdown

Cascade deletes are enforced in the schema: removing a file removes its edges
and incoming edges in one transaction.

### Sync flow (extension → API)

1. Extension watches the workspace with `vscode.workspace.createFileSystemWatcher`.
2. File events are debounced (default 500ms) and batched.
3. For each changed file, the extension reads the content and calls the shared
   parser to extract imports.
4. The extension POSTs a `SyncRequest` to `/api/projects/{id}/sync` containing
   both upserts and deletions.
5. The server transactionally:
   - deletes any files in `deletedPaths` (edges cascade)
   - upserts each file
   - deletes the file's old edges
   - resolves each import spec against the project's known files
   - creates new edges

The UI auto-polls every 5 seconds; for true real-time, swap polling for
Server-Sent Events in `project-view.tsx`.

### Parser (`packages/shared/src/parsers`)

- `detect-language.ts` — maps file extension → language + UI color
- `parse-imports.ts` — regex-based extraction for JS/TS, Python, Go
- `resolve-import.ts` — turns a spec (`./foo`, `../bar`, `lodash`, `util`)
  into a known project-relative path. Falls back to `index.<ext>` for
  directory imports. Treats Python stdlib modules as external.
- `hash.ts` — SHA-1 content hash for change detection

### Graph UI (`apps/web/src/components/project-view.tsx`)

- React Flow for rendering
- dagre for automatic LR/TB layout
- Filters: language chips, free-text search
- Sidebar: connected components, top-connected files, per-file in/out edges
- MiniMap + zoom controls
- Live stats: file count, edge count, isolated files, language breakdown

### Doc generation (`apps/web/src/lib/docs.ts`)

Three pure functions build PRD, HLD, and LLD markdown from the current graph.
The output is structural (file catalog, components, hot spots) and explicitly
marked as a stub. Drop in an OpenAI / Anthropic client where indicated and
pass `ctx` (graph + stats) into a prompt to enrich.

## REST API

All routes accept an optional `Authorization: Bearer <KGV_API_TOKEN>` header
(if `KGV_API_TOKEN` is set in `apps/web/.env`).

| Method | Path                            | Description                                |
| ------ | ------------------------------- | ------------------------------------------ |
| GET    | `/api/projects`                 | List all projects with file/edge counts    |
| POST   | `/api/projects`                 | Create or fetch a project by name + path   |
| GET    | `/api/projects/{id}`            | Full project + graph payload + stats       |
| PATCH  | `/api/projects/{id}`            | Rename a project                           |
| DELETE | `/api/projects/{id}`            | Delete a project (cascades files + edges)  |
| POST   | `/api/projects/{id}/sync`       | Push file upserts + deletes from extension |
| GET    | `/api/projects/{id}/docs`       | List generated documents                   |
| POST   | `/api/projects/{id}/docs?type=` | Generate `PRD` / `HLD` / `LLD`             |

The `sync` endpoint expects:

```json
{
  "projectId": "...",
  "files": [
    {
      "path": "src/index.ts",
      "language": "typescript",
      "hash": "sha1...",
      "imports": [
        { "raw": "./util", "type": "import", "line": 1, "resolved": null }
      ]
    }
  ],
  "deletedPaths": ["src/old.ts"]
}
```

`resolved` is optional and is recomputed server-side against the project's
known files.

## Configuration

### Web app (`apps/web/.env`)

| Variable         | Default                | Purpose                          |
| ---------------- | ---------------------- | -------------------------------- |
| `DATABASE_URL`   | `file:./dev.db`        | Prisma datasource                |
| `KGV_API_TOKEN`  | _(empty)_              | If set, required on all requests |

### VS Code extension (Settings → Extensions → Knowledge Graph)

| Setting              | Default                | Purpose                                |
| -------------------- | ---------------------- | -------------------------------------- |
| `kgv.apiUrl`         | `http://localhost:3000`| Dashboard base URL                     |
| `kgv.apiToken`       | _(empty)_              | Bearer token if server requires it     |
| `kgv.ignore`         | node_modules, .git, …  | Glob patterns to skip                  |
| `kgv.maxFileSizeKb`  | `512`                  | Files larger than this are skipped     |
| `kgv.syncDebounceMs` | `500`                  | Debounce window for batching events    |

## Limitations & next steps

- **AI generation is stubbed.** `apps/web/src/lib/docs.ts` produces structural
  markdown. Wire your LLM provider in `generateDocument()` to enrich with
  semantic summaries.
- **Polling instead of push.** The UI polls every 5s. Add SSE or WebSockets
  for instant updates.
- **Parser is regex-based.** It handles 95% of common code; a real parser
  (ts-morph / tree-sitter) would catch dynamic imports and re-exports more
  reliably.
- **No cycle detection** in the graph view. Add a "Show cycles" toggle to
  surface strong-coupling issues.
- **Single SQLite file.** Fine for local dev and small teams. Migrate to
  Postgres by changing the Prisma datasource.

## Scripts

| Command                                  | What it does                       |
| ---------------------------------------- | ---------------------------------- |
| `npm run dev`                            | Start the web app on `:3000`       |
| `npm run build`                          | Build all workspaces               |
| `npm run db:push --workspace=apps/web`   | Sync Prisma schema to SQLite       |
| `npm run db:studio --workspace=apps/web` | Open Prisma Studio                 |
| `npm run ext:dev`                        | Watch-compile the VS Code ext      |

## Verifying the setup

A quick smoke test without the extension:

```bash
# Start the dev server
npm run dev

# In another terminal, register a project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke","path":"/tmp/smoke"}'

# Then use scripts/build-sync.cjs (see scripts/) to build a payload
# from any local folder and POST it to /api/projects/{id}/sync.
```

Or open the dashboard, click **New Project**, point it at any folder, and use
the extension to sync it.

## License

MIT
