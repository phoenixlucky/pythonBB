<script setup lang="ts">
import { ref } from "vue";
import { useAppStore } from "@/stores/app";
import { chooseFile } from "@/lib/dialog";
import { describeError } from "@/lib/tauri";

const app = useAppStore();
const wallpaperError = ref("");
const importingWallpaper = ref(false);
const defaultWallpaper = "/bg-v2.webp";
const builtInWallpapers = [
  { name: "科技蓝", path: defaultWallpaper, value: "" },
  { name: "樱花", path: "/bg.webp", value: "/bg.webp" },
];

function selectWallpaper(value: string) {
  void app.saveSettings({ wallpaper: value });
}

function isWallpaperSelected(value: string) {
  return app.settings.wallpaper === value;
}

async function chooseCondaPath() {
  try {
    const selected = await chooseFile(app.settings.condaPath || "", [{ name: "Conda executable", extensions: ["exe", "bat", "cmd"] }]);
    if (selected) await app.saveSettings({ condaPath: selected });
  } catch (cause) { app.error = describeError(cause, "选择 Conda 路径失败"); }
}

function importWallpaper(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  wallpaperError.value = "";
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    wallpaperError.value = "请选择 PNG、JPEG 或 WebP 图片。";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    wallpaperError.value = "壁纸不能超过 10MB。";
    return;
  }
  importingWallpaper.value = true;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    importingWallpaper.value = false;
    if (typeof reader.result === "string") void app.saveSettings({ wallpaper: reader.result });
  });
  reader.addEventListener("error", () => { importingWallpaper.value = false; wallpaperError.value = "读取壁纸失败，请重试。"; });
  reader.readAsDataURL(file);
}

function resetAppearance() {
  void app.saveSettings({ wallpaper: "", primary: "#2563eb", secondary: "#0ea5e9", ink: "#0f172a", compactMode: false });
}
</script>

<template>
  <section class="content">
    <div class="page-heading">
      <div><span class="eyebrow">// Client Settings</span><h1>客户端设置</h1><p>设置保存在本机应用数据目录，不经过网络。</p></div>
      <button class="secondary" @click="resetAppearance">恢复默认外观</button>
    </div>
    <div class="settings-layout">
      <article class="card form-card settings-card">
        <div class="settings-section-heading"><div><span class="eyebrow">Workspace</span><h2>工作区</h2></div><span>本机保存</span></div>
        <label>首页标语<input :value="app.settings.tagline" maxlength="60" @change="app.saveSettings({ tagline: ($event.target as HTMLInputElement).value })" /></label>
        <label>Conda 可执行文件（可选）<div class="input-action"><input :value="app.settings.condaPath || ''" placeholder="D:\ProgramData\miniconda3\Scripts\conda.exe" @change="app.saveSettings({ condaPath: ($event.target as HTMLInputElement).value.trim() || undefined })" /><button class="secondary" type="button" @click="chooseCondaPath">选择</button></div></label>
        <p class="hint">填写后将优先使用该 Conda 路径，适合未加入 PATH 的安装。</p>
        <label>背景壁纸<input type="file" accept="image/png,image/jpeg,image/webp" :disabled="importingWallpaper" @change="importWallpaper" /></label>
        <p v-if="wallpaperError" class="field-error" role="alert">{{ wallpaperError }}</p>
        <div class="wallpaper-section">
          <div class="settings-subheading"><strong>内置壁纸</strong><span>点击预览并应用</span></div>
          <div class="wallpaper-grid">
            <button v-for="wallpaper in builtInWallpapers" :key="wallpaper.path" type="button" class="wallpaper-option" :class="{ selected: isWallpaperSelected(wallpaper.value) }" :aria-label="`使用${wallpaper.name}壁纸`" :aria-pressed="isWallpaperSelected(wallpaper.value)" @click="selectWallpaper(wallpaper.value)">
              <img :src="wallpaper.path" :alt="`${wallpaper.name}壁纸预览`" />
              <span>{{ wallpaper.name }}</span>
            </button>
          </div>
        </div>
        <div class="settings-actions"><button class="secondary" :disabled="!app.settings.wallpaper" @click="app.saveSettings({ wallpaper: '' })">恢复默认壁纸</button><button class="link-button" @click="resetAppearance">重置外观颜色</button></div>
        <div class="color-fields">
          <label>主色<input type="color" :value="app.settings.primary" @change="app.saveSettings({ primary: ($event.target as HTMLInputElement).value })" /></label>
          <label>辅助色<input type="color" :value="app.settings.secondary" @change="app.saveSettings({ secondary: ($event.target as HTMLInputElement).value })" /></label>
          <label>文字色<input type="color" :value="app.settings.ink" @change="app.saveSettings({ ink: ($event.target as HTMLInputElement).value })" /></label>
        </div>
        <label class="switch-row"><input type="checkbox" :checked="app.settings.compactMode" @change="app.saveSettings({ compactMode: ($event.target as HTMLInputElement).checked })" />紧凑布局<span class="field-note">减少卡片间距，适合小屏幕</span></label>
      </article>
      <aside class="card settings-preview" :style="{ '--preview-primary': app.settings.primary, '--preview-secondary': app.settings.secondary, '--preview-ink': app.settings.ink, backgroundImage: `url(${app.settings.wallpaper || defaultWallpaper})` }">
        <span class="eyebrow">Preview</span>
        <h2>外观预览</h2>
        <div class="preview-window">
          <div class="preview-bar"><span class="preview-dot"></span><strong>Python 工作区</strong><small>环境 3</small></div>
          <div class="preview-body"><span class="eyebrow">// Workspace</span><h3>{{ app.settings.tagline }}</h3><p>统一查看 Python、Conda、venv 与 uv 环境。</p><button class="preview-primary">刷新状态</button></div>
        </div>
        <p class="hint">颜色和壁纸会实时应用到工作区。若文字对比度不足，建议恢复默认文字色。</p>
      </aside>
    </div>
  </section>
</template>
