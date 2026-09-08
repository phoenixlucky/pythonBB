<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useAppStore } from "@/stores/app";
import CondaPanel from "@/components/CondaPanel.vue";
import VenvPanel from "@/components/VenvPanel.vue";
import PackagesPanel from "@/components/PackagesPanel.vue";
import PythonPanel from "@/components/PythonPanel.vue";
import SetupPanel from "@/components/SetupPanel.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import UvPanel from "@/components/UvPanel.vue";
import { useWorkspaceStore } from "@/stores/workspace";

const app = useAppStore();
const workspace = useWorkspaceStore();
const activePanel = ref("overview");
const panels = [
  { id: "overview", icon: ">_", label: "概览" },
  { id: "setup", icon: "↻", label: "初始化配置" },
  { id: "conda", icon: "≈", label: "Conda" },
  { id: "python", icon: "»", label: "Python 版本" },
  { id: "venv", icon: "▣", label: "虚拟环境" },
  { id: "uv", icon: "u", label: "uv 管理" },
  { id: "packages", icon: "λ", label: "包管理" },
  { id: "settings", icon: "⚙", label: "客户端设置" },
];
let processTimer = 0;

onMounted(async () => {
  await app.loadSettings();
  await app.refresh();
  await workspace.refreshAll();
  await workspace.loadProcesses();
  processTimer = window.setInterval(() => { void workspace.loadProcesses(); }, 1000);
});

onUnmounted(() => { if (processTimer) window.clearInterval(processTimer); });
</script>

<template>
  <div class="app-shell" :class="{ compact: app.settings.compactMode }" :style="{ '--client-primary': app.settings.primary, '--client-secondary': app.settings.secondary, '--client-ink': app.settings.ink, backgroundImage: `url(${app.settings.wallpaper || '/bg-v2.webp'})` }">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark"><span class="brand-icon"><img src="/app-icon.png" alt="" /></span><span class="brand-copy"><strong>WJ Python</strong><small>管理大师</small></span></div>
        <p>本地优先的 Python 环境控制台</p>
      </div>
      <div class="sidebar-section">
        <span class="section-label">工作区</span>
        <nav>
          <button v-for="panel in panels" :key="panel.id" :class="{ active: activePanel === panel.id }" @click="activePanel = panel.id">
            <span class="nav-icon">{{ panel.icon }}</span>{{ panel.label }}
          </button>
        </nav>
      </div>
      <div class="sidebar-foot">
        <span class="status-dot" :class="{ busy: app.loading }"></span>
        <span>{{ app.loading ? "读取中" : "就绪" }}</span>
        <small>Tauri Client</small>
      </div>
    </aside>

    <main class="main-stage">
      <header class="topbar">
        <div class="topbar-context"><span class="topbar-dot"></span><div><strong>Python 工作区</strong><span>{{ app.settings.tagline }}</span></div></div>
        <div class="runtime-chips">
          <span>{{ app.overview?.runtime.python || "Python --" }}</span>
          <span>{{ app.overview?.runtime.conda || "Conda --" }}</span>
        </div>
      </header>

      <section v-if="activePanel === 'overview'" class="content">
        <div class="page-heading">
          <div><span class="eyebrow">// Overview</span><h1>系统与运行时总览</h1><p>查看本机 Python 工具链和 Conda 环境状态。</p></div>
          <button class="primary" :disabled="app.loading" @click="app.refresh">{{ app.loading ? "刷新中…" : "刷新状态" }}</button>
        </div>
        <div v-if="app.error" class="error-banner">{{ app.error }}</div>
        <div class="stat-grid">
          <article><span>Python</span><strong>{{ app.overview?.runtime.python || "--" }}</strong><small>系统默认解释器</small></article>
          <article><span>Conda 环境</span><strong>{{ app.overview?.environments.length ?? "--" }}</strong><small>已发现环境</small></article>
          <article><span>平台</span><strong>{{ app.overview?.runtime.platform || "--" }}</strong><small>操作系统</small></article>
        </div>
        <div class="dashboard-grid">
          <article class="card environment-card">
            <div class="card-heading"><div><span class="eyebrow">Environments</span><h2>Conda 环境</h2></div><span>{{ app.lastRefreshLabel }}</span></div>
            <div v-if="!app.overview?.environments.length && !app.loading" class="empty">没有发现 Conda 环境</div>
            <div v-for="environment in app.overview?.environments" :key="environment.prefix" class="environment-row">
              <div class="env-avatar">py</div><div class="env-main"><strong>{{ environment.name }}</strong><span>{{ environment.prefix }}</span></div>
              <div class="env-meta"><strong>{{ environment.python }}</strong><span>{{ environment.packageCount }} 个包</span></div>
              <span v-if="environment.active" class="active-badge">当前</span>
            </div>
          </article>
          <article class="card next-card">
            <span class="eyebrow">Next step</span><h2>继续管理环境</h2><p>Conda、虚拟环境与包管理模块会沿用同一套 Rust 命令层，操作过程可追踪且不会离开本机。</p>
            <button class="secondary" @click="activePanel = 'conda'">打开 Conda</button>
          </article>
        </div>
      </section>

      <CondaPanel v-else-if="activePanel === 'conda'" />
      <VenvPanel v-else-if="activePanel === 'venv'" />
      <UvPanel v-else-if="activePanel === 'uv'" />
      <PackagesPanel v-else-if="activePanel === 'packages'" />
      <PythonPanel v-else-if="activePanel === 'python'" />
      <SetupPanel v-else-if="activePanel === 'setup'" />
      <SettingsPanel v-else-if="activePanel === 'settings'" />
      <section v-else class="content placeholder-page">
        <span class="eyebrow">// {{ activePanel }}</span><h1>{{ panels.find((panel) => panel.id === activePanel)?.label }}</h1>
        <div class="card"><h2>模块已接入迁移骨架</h2><p>这里将接入 Rust domain/service 能力。当前基础链路已可运行。</p><button class="secondary" @click="activePanel = 'overview'">返回概览</button></div>
      </section>
      <div v-if="workspace.error || workspace.message || workspace.output || workspace.currentTask" class="operation-log">
        <div class="log-head"><strong>{{ workspace.error || workspace.message || workspace.currentTask?.message || "最近一次操作" }}</strong><span v-if="workspace.currentTask?.status === 'running'">{{ workspace.currentTask.progress }}%</span><button class="link-button" @click="workspace.clearLog">清空</button></div>
        <pre v-if="workspace.output">{{ workspace.output }}</pre>
      </div>
    </main>
  </div>
</template>

<style scoped>
.button-row { display: flex; gap: 8px; align-items: center; }
.operation-log { margin: 0 44px 24px; padding: 14px 16px; border: 1px solid #dfe6ef; border-radius: 10px; background: #fff; color: #556479; font-size: 12px; }
.log-head { display: flex; align-items: center; gap: 12px; }
.log-head span { color: #8490a3; margin-left: auto; }
.log-head .link-button { margin-left: 8px; }
.operation-log strong { color: #2563eb; }
.operation-log pre { max-height: 220px; overflow: auto; margin: 10px 0 0; white-space: pre-wrap; font: 11px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; color: #66758b; }
:global(.app-shell) { background-position: center; background-size: cover; background-attachment: fixed; }
:global(.primary) { background: var(--client-primary, #2563eb); }
:global(.secondary), :global(.link-button) { color: var(--client-primary, #2563eb); }
:global(.brand-mark span), :global(.topbar b) { color: var(--client-primary, #2563eb); }
:global(.page-heading h1), :global(.placeholder-page h1) { color: var(--client-ink, #172033); }
</style>
