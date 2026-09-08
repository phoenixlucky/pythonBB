<script setup lang="ts">
import { useAppStore } from "@/stores/app";

const app = useAppStore();

function importWallpaper(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => { if (typeof reader.result === "string") void app.saveSettings({ wallpaper: reader.result }); });
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
        <label>首页标语<input :value="app.settings.tagline" maxlength="60" @input="app.saveSettings({ tagline: ($event.target as HTMLInputElement).value })" /></label>
        <label>Conda 可执行文件（可选）<input :value="app.settings.condaPath || ''" placeholder="D:\ProgramData\miniconda3\Scripts\conda.exe" @change="app.saveSettings({ condaPath: ($event.target as HTMLInputElement).value.trim() || undefined })" /></label>
        <p class="hint">填写后将优先使用该 Conda 路径，适合未加入 PATH 的安装。</p>
        <label>背景壁纸<input type="file" accept="image/png,image/jpeg,image/webp" @change="importWallpaper" /></label>
        <div class="settings-actions"><button class="secondary" :disabled="!app.settings.wallpaper" @click="app.saveSettings({ wallpaper: '' })">恢复默认壁纸</button><button class="link-button" @click="resetAppearance">重置外观颜色</button></div>
        <div class="color-fields">
          <label>主色<input type="color" :value="app.settings.primary" @input="app.saveSettings({ primary: ($event.target as HTMLInputElement).value })" /></label>
          <label>辅助色<input type="color" :value="app.settings.secondary" @input="app.saveSettings({ secondary: ($event.target as HTMLInputElement).value })" /></label>
          <label>文字色<input type="color" :value="app.settings.ink" @input="app.saveSettings({ ink: ($event.target as HTMLInputElement).value })" /></label>
        </div>
        <label class="switch-row"><input type="checkbox" :checked="app.settings.compactMode" @change="app.saveSettings({ compactMode: ($event.target as HTMLInputElement).checked })" />紧凑布局<span class="field-note">减少卡片间距，适合小屏幕</span></label>
      </article>
      <aside class="card settings-preview" :style="{ '--preview-primary': app.settings.primary, '--preview-secondary': app.settings.secondary, '--preview-ink': app.settings.ink, backgroundImage: app.settings.wallpaper ? `url(${app.settings.wallpaper})` : undefined }">
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
