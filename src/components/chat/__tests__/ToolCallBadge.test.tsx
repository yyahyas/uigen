import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => cleanup());

function strReplaceCall(command: string, path: string): ToolInvocation {
  return { toolCallId: "id", toolName: "str_replace_editor", args: { command, path }, state: "call" };
}

function strReplaceResult(command: string, path: string): ToolInvocation {
  return { toolCallId: "id", toolName: "str_replace_editor", args: { command, path }, state: "result", result: "ok" };
}

function fileManagerResult(command: string, path: string, new_path?: string): ToolInvocation {
  return {
    toolCallId: "id",
    toolName: "file_manager",
    args: { command, path, ...(new_path ? { new_path } : {}) },
    state: "result",
    result: "ok",
  };
}

// str_replace_editor label tests

test("shows 'Creating <filename>' for create command", () => {
  render(<ToolCallBadge tool={strReplaceResult("create", "/App.jsx")} />);
  expect(screen.getByText("Creating App.jsx")).toBeDefined();
});

test("shows 'Editing <filename>' for str_replace command", () => {
  render(<ToolCallBadge tool={strReplaceResult("str_replace", "/components/Button.tsx")} />);
  expect(screen.getByText("Editing Button.tsx")).toBeDefined();
});

test("shows 'Editing <filename>' for insert command", () => {
  render(<ToolCallBadge tool={strReplaceResult("insert", "/App.jsx")} />);
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

test("shows 'Viewing <filename>' for view command", () => {
  render(<ToolCallBadge tool={strReplaceResult("view", "/App.jsx")} />);
  expect(screen.getByText("Viewing App.jsx")).toBeDefined();
});

test("shows 'Working on file' fallback when command is missing", () => {
  const tool: ToolInvocation = {
    toolCallId: "id",
    toolName: "str_replace_editor",
    args: {},
    state: "call",
  };
  render(<ToolCallBadge tool={tool} />);
  expect(screen.getByText("Working on file")).toBeDefined();
});

test("extracts filename from nested path", () => {
  render(<ToolCallBadge tool={strReplaceResult("create", "/src/components/ui/Card.tsx")} />);
  expect(screen.getByText("Creating Card.tsx")).toBeDefined();
});

// file_manager label tests

test("shows 'Deleting <filename>' for delete command", () => {
  render(<ToolCallBadge tool={fileManagerResult("delete", "/OldComponent.tsx")} />);
  expect(screen.getByText("Deleting OldComponent.tsx")).toBeDefined();
});

test("shows 'Renaming <old> to <new>' for rename command", () => {
  render(<ToolCallBadge tool={fileManagerResult("rename", "/Button.tsx", "/PrimaryButton.tsx")} />);
  expect(screen.getByText("Renaming Button.tsx to PrimaryButton.tsx")).toBeDefined();
});

test("shows 'Renaming <filename>' when new_path is absent", () => {
  render(<ToolCallBadge tool={fileManagerResult("rename", "/Button.tsx")} />);
  expect(screen.getByText("Renaming Button.tsx")).toBeDefined();
});

// Status indicator tests

test("shows green dot when state is result", () => {
  const { container } = render(<ToolCallBadge tool={strReplaceResult("create", "/App.jsx")} />);
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("shows spinner when state is call (in progress)", () => {
  const { container } = render(<ToolCallBadge tool={strReplaceCall("create", "/App.jsx")} />);
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

// Unknown tool fallback

test("shows raw tool name for unknown tool", () => {
  const tool: ToolInvocation = {
    toolCallId: "id",
    toolName: "unknown_tool",
    args: {},
    state: "result",
    result: "ok",
  };
  render(<ToolCallBadge tool={tool} />);
  expect(screen.getByText("unknown_tool")).toBeDefined();
});
