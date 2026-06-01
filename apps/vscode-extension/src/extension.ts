import * as vscode from "vscode";
import { ApiClient } from "./api-client";
import { registerCommands } from "./commands";
import { syncAll, startWatching, stopWatching } from "./sync";

let statusBar: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  const config = () => vscode.workspace.getConfiguration("kgv");

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = "$(graph) Knowledge Graph";
  statusBar.tooltip = "Knowledge Graph Visualizer";
  statusBar.command = "kgv.openDashboard";
  statusBar.show();
  context.subscriptions.push(statusBar);

  const client = new ApiClient(
    () => config().get<string>("apiUrl") ?? "http://localhost:3000",
    () => config().get<string>("apiToken") ?? "",
  );

  registerCommands(context, client, statusBar);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("kgv.apiUrl") ||
        e.affectsConfiguration("kgv.apiToken")
      ) {
        client.reset();
      }
    }),
  );

  const debounceMs = () =>
    config().get<number>("syncDebounceMs") ?? 500;

  await startWatching(context, client, debounceMs, statusBar);

  context.subscriptions.push({
    dispose: () => stopWatching(),
  });
}

export function deactivate() {
  stopWatching();
}
