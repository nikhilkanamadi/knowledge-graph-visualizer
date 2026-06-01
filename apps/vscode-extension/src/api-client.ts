import * as https from "node:https";
import * as http from "node:http";
import { URL } from "node:url";
import type { ProjectDTO, SyncFileInput, SyncRequest } from "@kgv/shared";

type ProjectLookup = { id: string };

export class ApiClient {
  private cachedBase: string | null = null;
  private cachedToken: string | null = null;

  constructor(
    private getBase: () => string,
    private getToken: () => string,
  ) {}

  reset(): void {
    this.cachedBase = null;
    this.cachedToken = null;
  }

  private base(): string {
    if (this.cachedBase === null) this.cachedBase = this.getBase();
    return this.cachedBase.replace(/\/$/, "");
  }

  private token(): string {
    if (this.cachedToken === null) this.cachedToken = this.getToken();
    return this.cachedToken;
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = new URL(this.base() + path);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Content-Length": payload ? String(Buffer.byteLength(payload)) : "0",
    };
    if (this.token()) headers["Authorization"] = `Bearer ${this.token()}`;

    return new Promise<T>((resolve, reject) => {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c as Buffer));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (!res.statusCode || res.statusCode >= 400) {
              reject(
                new Error(
                  `${method} ${path} -> ${res.statusCode} ${text.slice(0, 200)}`,
                ),
              );
              return;
            }
            try {
              resolve(text ? (JSON.parse(text) as T) : (undefined as T));
            } catch (e) {
              reject(e as Error);
            }
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async listProjects(): Promise<ProjectDTO[]> {
    return this.request<ProjectDTO[]>("GET", "/api/projects");
  }

  async createOrFindProject(name: string, path: string): Promise<ProjectLookup> {
    return this.request<ProjectLookup>("POST", "/api/projects", { name, path });
  }

  async sync(req: SyncRequest): Promise<{ ok: true; stats: { filesUpserted: number; filesDeleted: number; edgesCreated: number; edgesDeleted: number } }> {
    return this.request("POST", `/api/projects/${req.projectId}/sync`, req);
  }

  async syncFiles(
    projectId: string,
    files: SyncFileInput[],
    deletedPaths: string[] = [],
  ) {
    const req: SyncRequest = { projectId, files, deletedPaths };
    return this.sync(req);
  }
}
