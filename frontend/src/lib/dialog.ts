import { open, save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@/lib/tauri";

export async function chooseDirectory(defaultPath = "") {
  if (!isTauri) return null;
  const selected = await open({ directory: true, multiple: false, defaultPath: defaultPath || undefined });
  return typeof selected === "string" ? selected : null;
}

export async function chooseFile(defaultPath = "", filters?: { name: string; extensions: string[] }[]) {
  if (!isTauri) return null;
  const selected = await open({ directory: false, multiple: false, defaultPath: defaultPath || undefined, filters });
  return typeof selected === "string" ? selected : null;
}

export async function chooseSaveFile(defaultPath = "", filters?: { name: string; extensions: string[] }[]) {
  if (!isTauri) return null;
  const selected = await save({ defaultPath: defaultPath || undefined, filters });
  return typeof selected === "string" ? selected : null;
}
