import * as vscode from "vscode";
import * as path from "node:path";
import type { ApiClient } from "./api-client";
import { setKnownProject, syncAll, getKnownProject } from "./sync";

export function registerCommands(
  context: vscode.ExtensionContext,
  client: ApiClient,
  statusBar: vscode.StatusBarItem,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("kgv.registerProject", async () => {
      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage("No workspace open.");
        return;
      }
      const folder = vscode.workspace.workspaceFolders[0];
      const name = path.basename(folder.uri.fsPath);
      try {
        const project = await client.createOrFindProject(
          name,
          folder.uri.fsPath,
        );
        setKnownProject({ id: project.id, path: folder.uri.fsPath });
        vscode.window.showInformationMessage(
          `Knowledge Graph: registered "${name}" (id ${project.id}).`,
        );
        statusBar.text = `$(graph) KG: ${name}`;
        await syncAll(client, statusBar);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Registration failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("kgv.syncNow", async () => {
      const project = getKnownProject();
      if (!project) {
        vscode.window.showWarningMessage(
          'Run "Knowledge Graph: Register Current Workspace" first.',
        );
        return;
      }
      await syncAll(client, statusBar);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("kgv.openDashboard", async () => {
      const cfg = vscode.workspace.getConfiguration("kgv");
      const base = (cfg.get<string>("apiUrl") ?? "http://localhost:3000").replace(/\/$/, "");
      const project = getKnownProject();
      const url = project
        ? `${base}/projects/${project.id}`
        : base;
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("kgv.setApiUrl", async () => {
      const current = vscode.workspace
        .getConfiguration("kgv")
        .get<string>("apiUrl");
      const url = await vscode.window.showInputBox({
        prompt: "Knowledge Graph API URL",
        value: current,
        placeHolder: "http://localhost:3000",
      });
      if (url) {
        await vscode.workspace
          .getConfiguration("kgv")
          .update("apiUrl", url, vscode.ConfigurationTarget.Global);
      }
    }),
  );
}
