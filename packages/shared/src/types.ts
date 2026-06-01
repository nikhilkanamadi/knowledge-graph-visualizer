export type DocumentType = "PRD" | "HLD" | "LLD";

export type EdgeType = "import" | "require" | "dynamic" | "reference";

export interface ProjectDTO {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  fileCount: number;
  edgeCount: number;
}

export interface FileDTO {
  id: string;
  projectId: string;
  path: string;
  language: string | null;
  hash: string | null;
  updatedAt: string;
}

export interface EdgeDTO {
  id: string;
  fromId: string;
  toId: string;
  type: EdgeType;
}

export interface DocumentDTO {
  id: string;
  projectId: string;
  type: DocumentType;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  path: string;
  language: string | null;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
}

export interface GraphPayload {
  nodes: GraphNode[];
  links: GraphLink[];
  connectedComponents: string[][];
}

export interface ParsedImport {
  raw: string;
  resolved: string | null;
  type: EdgeType;
  line: number;
}

export interface ParsedFile {
  path: string;
  language: string;
  imports: ParsedImport[];
  hash: string;
}

export interface SyncFileInput {
  path: string;
  language: string;
  hash: string;
  imports: ParsedImport[];
}

export interface SyncRequest {
  projectId: string;
  files: SyncFileInput[];
  deletedPaths?: string[];
}
