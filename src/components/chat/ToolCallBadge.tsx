"use client";

import { Loader2, FilePlus, FilePen, Eye, Trash2, ArrowRight } from "lucide-react";
import type { ToolInvocation } from "ai";
import type React from "react";

interface ToolCallBadgeProps {
  tool: ToolInvocation;
}

function extractFilename(path: unknown): string {
  if (typeof path !== "string" || !path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

type LabelResult = { Icon: React.ElementType; text: string };

function resolveLabel(tool: ToolInvocation): LabelResult {
  const { toolName } = tool;
  const args = tool.args as Record<string, unknown>;

  if (toolName === "str_replace_editor") {
    const command = args?.command as string | undefined;
    const filename = extractFilename(args?.path) || "file";

    switch (command) {
      case "create":
        return { Icon: FilePlus, text: `Creating ${filename}` };
      case "str_replace":
      case "insert":
        return { Icon: FilePen, text: `Editing ${filename}` };
      case "view":
        return { Icon: Eye, text: `Viewing ${filename}` };
      default:
        return { Icon: FilePen, text: `Working on ${filename}` };
    }
  }

  if (toolName === "file_manager") {
    const command = args?.command as string | undefined;
    const filename = extractFilename(args?.path) || "file";
    const newFilename = extractFilename(args?.new_path);

    switch (command) {
      case "delete":
        return { Icon: Trash2, text: `Deleting ${filename}` };
      case "rename":
        return {
          Icon: ArrowRight,
          text: newFilename
            ? `Renaming ${filename} to ${newFilename}`
            : `Renaming ${filename}`,
        };
      default:
        return { Icon: FilePen, text: "File operation" };
    }
  }

  return { Icon: FilePen, text: toolName };
}

export function ToolCallBadge({ tool }: ToolCallBadgeProps) {
  const isDone = tool.state === "result";
  const { Icon, text } = resolveLabel(tool);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600 flex-shrink-0" />
      )}
      <Icon className="w-3 h-3 text-neutral-500 flex-shrink-0" />
      <span className="text-neutral-700">{text}</span>
    </div>
  );
}
