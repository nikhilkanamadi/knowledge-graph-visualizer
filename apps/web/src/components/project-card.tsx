import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "@/components/ui";
import { GitBranch, FileCode2, Network } from "lucide-react";
import type { ProjectDTO } from "@kgv/shared";

export function ProjectCard({ project }: { project: ProjectDTO }) {
  return (
    <Card className="h-full transition-colors hover:border-primary/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate">{project.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {new Date(project.createdAt).toLocaleDateString()}
          </Badge>
        </div>
        <CardDescription className="truncate font-mono text-xs">
          {project.path}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileCode2 className="h-4 w-4" />
            <span>{project.fileCount} files</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Network className="h-4 w-4" />
            <span>{project.edgeCount} refs</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
