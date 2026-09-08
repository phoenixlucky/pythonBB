import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { describeError, invokeCommand } from "@/lib/tauri";
import type { AppSettings, Overview } from "@/types";

const defaultSettings: AppSettings = {
  tagline: "以工程控制台的方式管理 Python 环境",
  compactMode: false,
  primary: "#2563eb",
  secondary: "#0ea5e9",
  ink: "#0f172a",
  wallpaper: "",
};

export const useAppStore = defineStore("app", () => {
  const overview = ref<Overview | null>(null);
  const settings = ref<AppSettings>({ ...defaultSettings });
  const loading = ref(false);
  const error = ref("");
  const lastRefreshLabel = computed(() => {
    if (!overview.value) return "尚未刷新";
    const value = overview.value.checkedAt.startsWith("unix:")
      ? Number(overview.value.checkedAt.slice(5)) * 1000
      : overview.value.checkedAt;
    return new Date(value).toLocaleTimeString();
  });

  async function refresh() {
    loading.value = true;
    error.value = "";
    try {
      overview.value = await invokeCommand<Overview>("get_overview");
    } catch (cause) {
      error.value = describeError(cause, "刷新失败");
    } finally {
      loading.value = false;
    }
  }

  async function loadSettings() {
    try {
      settings.value = { ...defaultSettings, ...(await invokeCommand<Partial<AppSettings>>("get_settings")) };
    } catch {
      settings.value = { ...defaultSettings };
    }
  }

  let saveQueue: Promise<unknown> = Promise.resolve();
  async function saveSettings(patch: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...patch };
    const snapshot = { ...settings.value };
    saveQueue = saveQueue.catch(() => undefined).then(() => invokeCommand("save_settings", { settings: snapshot }));
    try { await saveQueue; } catch (cause) { error.value = describeError(cause, "设置保存失败"); }
  }

  return { overview, settings, loading, error, lastRefreshLabel, refresh, loadSettings, saveSettings };
});
