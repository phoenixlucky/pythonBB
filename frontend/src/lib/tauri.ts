import { invoke } from "@tauri-apps/api/core";

export function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

export function describeError(cause: unknown, fallback = "操作失败") {
  const message = cause instanceof Error ? cause.message : String(cause || fallback);
  if (message.includes("reading 'invoke'") || message.includes("reading \"invoke\"")) {
    return "当前页面未连接到桌面命令层，请使用 Tauri 桌面客户端运行。";
  }
  return message || fallback;
}

export const isTauri = Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
