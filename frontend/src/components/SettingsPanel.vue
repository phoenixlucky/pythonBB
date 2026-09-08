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
</script>
<template><section class="content"><div class="page-heading"><div><span class="eyebrow">// Client Settings</span><h1>客户端设置</h1><p>设置保存在本机应用数据目录，不经过网络。</p></div></div><article class="card form-card settings-card"><label>首页标语<input :value="app.settings.tagline" maxlength="60" @input="app.saveSettings({ tagline: ($event.target as HTMLInputElement).value })" /></label><label>Conda 可执行文件（可选）<input :value="app.settings.condaPath || ''" placeholder="D:\ProgramData\miniconda3\Scripts\conda.exe" @change="app.saveSettings({ condaPath: ($event.target as HTMLInputElement).value.trim() || undefined })" /></label><p class="hint">填写后将优先使用该 Conda 路径，适合未加入 PATH 的安装。</p><label>背景壁纸<input type="file" accept="image/png,image/jpeg,image/webp" @change="importWallpaper" /></label><button class="secondary" :disabled="!app.settings.wallpaper" @click="app.saveSettings({ wallpaper: '' })">恢复默认壁纸</button><label>主色<input type="color" :value="app.settings.primary" @input="app.saveSettings({ primary: ($event.target as HTMLInputElement).value })" /></label><label>辅助色<input type="color" :value="app.settings.secondary" @input="app.saveSettings({ secondary: ($event.target as HTMLInputElement).value })" /></label><label>文字色<input type="color" :value="app.settings.ink" @input="app.saveSettings({ ink: ($event.target as HTMLInputElement).value })" /></label><label class="switch-row"><input type="checkbox" :checked="app.settings.compactMode" @change="app.saveSettings({ compactMode: ($event.target as HTMLInputElement).checked })" />紧凑布局</label></article></section></template>
