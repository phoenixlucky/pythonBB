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
import { isTauri } from "@/lib/tauri";

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
const navGroups = [
  { label: "工作区", items: ["overview"] },
  { label: "运行时", items: ["setup", "conda", "python", "uv"] },
  { label: "环境与包", items: ["venv", "packages"] },
  { label: "系统", items: ["settings"] },
];
let processTimer = 0;

onMounted(async () => {
  await app.loadSettings();
  await Promise.all([app.refresh(), workspace.loadVenvs(), workspace.loadPythonVersions()]);
  if (app.overview) workspace.conda = app.overview.environments;
  if (isTauri) {
    await workspace.loadProcesses().catch(() => undefined);
    processTimer = window.setInterval(() => { void workspace.loadProcesses().catch(() => undefined); }, 1000);
  }
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
      <div v-for="(group, groupIndex) in navGroups" :key="group.label" class="sidebar-section" :class="{ 'sidebar-section-first': groupIndex === 0 }">
        <span class="section-label">{{ group.label }}</span>
        <nav>
          <button v-for="panelId in group.items" :key="panelId" :class="{ active: activePanel === panelId }" :aria-label="panels.find((panel) => panel.id === panelId)?.label" :title="panels.find((panel) => panel.id === panelId)?.label" @click="activePanel = panelId">
            <span class="nav-icon">{{ panels.find((panel) => panel.id === panelId)?.icon }}</span><span class="nav-label">{{ panels.find((panel) => panel.id === panelId)?.label }}</span>
          </button>
        </nav>
      </div>
      <div class="sidebar-foot">
        <span class="status-dot" :class="{ busy: app.loading }"></span>
        <span>{{ app.loading ? "读取中" : "就绪" }}</span>
      </div>
    </aside>

    <main class="main-stage">
      <header class="topbar">
        <div class="topbar-context"><span class="topbar-dot"></span><div><strong>Python 工作区</strong><span>{{ app.settings.tagline }}</span></div></div>
        <div class="runtime-chips">
          <span>{{ app.overview?.runtime.python || "Python --" }}</span>
          <span>{{ app.overview?.runtime.conda || "Conda --" }}</span>
          <span class="target-chip">环境 {{ workspace.targets.length }}</span>
        </div>
      </header>
      <div v-if="app.error" class="error-banner global-error-banner" role="alert">{{ app.error }}<button class="link-button" @click="app.error = ''">关闭</button></div>

      <section v-if="activePanel === 'overview'" class="content">
        <div class="page-heading">
          <div><span class="eyebrow">// Overview</span><h1>系统与运行时总览</h1><p>查看本机 Python 工具链和 Conda 环境状态。</p></div>
          <button class="primary" :disabled="app.loading" @click="app.refresh">{{ app.loading ? "刷新中…" : "刷新状态" }}</button>
        </div>
        <div class="stat-grid">
          <article><span>Python</span><strong>{{ app.overview?.runtime.python || "--" }}</strong><small>系统默认解释器</small></article>
          <article><span>Conda 环境</span><strong>{{ app.overview?.environments.length ?? "--" }}</strong><small>已发现环境</small></article>
          <article><span>虚拟环境</span><strong>{{ workspace.venvs.length }}</strong><small>包含 uv 创建的环境</small></article>
          <article><span>平台</span><strong>{{ app.overview?.runtime.platform || "--" }}</strong><small>操作系统</small></article>
        </div>
        <div class="dashboard-grid">
          <article class="card environment-card">
            <div class="card-heading"><div><span class="eyebrow">Environments</span><h2>可管理环境</h2></div><span>{{ app.lastRefreshLabel }}</span></div>
            <div v-if="!app.overview?.environments.length && !app.loading" class="empty">没有发现 Conda 环境</div>
            <div v-for="environment in app.overview?.environments" :key="environment.prefix" class="environment-row">
              <div class="env-avatar">py</div><div class="env-main"><strong>{{ environment.name }}</strong><span>{{ environment.prefix }}</span></div>
              <div class="env-meta"><strong>{{ environment.python }}</strong><span>{{ environment.packageCount }} 个包</span></div>
              <button class="row-action" :disabled="workspace.busy" @click="activePanel = 'conda'">管理</button>
              <span v-if="environment.active" class="active-badge">当前</span>
            </div>
            <div v-if="workspace.venvs.length" class="environment-divider"><span>虚拟环境</span><small>{{ workspace.venvs.length }} 个</small></div>
            <div v-for="environment in workspace.venvs.slice(0, 4)" :key="environment.path" class="environment-row">
              <div class="env-avatar venv-avatar">{{ environment.manager === "uv" ? "uv" : "venv" }}</div><div class="env-main"><strong>{{ environment.name }}</strong><span>{{ environment.path }}</span></div>
              <div class="env-meta"><strong>{{ environment.pythonVersion }}</strong><span>{{ environment.manager }}</span></div>
              <button class="row-action" :disabled="workspace.busy" @click="activePanel = 'venv'">管理</button>
            </div>
          </article>
          <article class="card next-card">
            <span class="eyebrow">Next step</span><h2>继续管理环境</h2><p>所有环境都可以进入同一套包管理流程。先选择环境类型，再执行创建、升级或安装。</p>
            <div class="next-actions"><button class="secondary" @click="activePanel = 'conda'">管理 Conda</button><button class="secondary" @click="activePanel = 'venv'">创建 venv / uv</button></div>
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
      <div v-if="workspace.error || workspace.message || workspace.output || workspace.currentTask" class="operation-log" :class="{ 'operation-error': workspace.error, 'operation-running': workspace.currentTask?.status === 'running' }" role="status" aria-live="polite">
        <div class="log-head"><span class="log-status-dot"></span><strong>{{ workspace.error || workspace.message || workspace.currentTask?.message || "最近一次操作" }}</strong><span v-if="workspace.currentTask?.status === 'running'">{{ workspace.currentTask.progress }}%</span><button v-if="workspace.currentTask?.status === 'running'" class="link-button" @click="workspace.cancelCurrentTask">取消任务</button><button class="link-button" @click="workspace.clearLog">清空</button></div>
        <div v-if="workspace.currentTask?.status === 'running'" class="task-progress"><span :style="{ width: `${workspace.currentTask.progress}%` }"></span></div>
        <small v-if="workspace.activeProcesses.length" class="process-note">正在运行 {{ workspace.activeProcesses.length }} 个本地进程</small>
        <pre v-if="workspace.output">{{ workspace.output }}</pre>
      </div>
    </main>
  </div>
</template>

<style scoped>
.button-row { display: flex; gap: 8px; align-items: center; }
.operation-log { position: sticky; bottom: 16px; z-index: 5; margin: 0 44px 24px; padding: 14px 16px; border: 1px solid #dfe6ef; border-radius: 10px; background: rgba(255,255,255,.96); box-shadow: 0 12px 28px rgba(15,23,42,.12); color: #556479; font-size: 12px; }
.log-head { display: flex; align-items: center; gap: 12px; }
.log-head span { color: #8490a3; margin-left: auto; }
.log-head .link-button { margin-left: 8px; }
.operation-log strong { color: #2563eb; }
.operation-error strong { color: #be123c; }
.log-status-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: #22c55e; }
.operation-running .log-status-dot { background: #f59e0b; }
.operation-error .log-status-dot { background: #e11d48; }
.task-progress { height: 5px; overflow: hidden; margin-top: 10px; border-radius: 99px; background: #e8eef7; }
.task-progress span { display: block; height: 100%; border-radius: inherit; background: var(--client-primary, #2563eb); transition: width .2s ease; }
.process-note { display: block; margin-top: 8px; color: #8490a3; }
.operation-log pre { max-height: 220px; overflow: auto; margin: 10px 0 0; white-space: pre-wrap; font: 11px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; color: #66758b; }
:global(.app-shell) { background-position: center; background-size: cover; background-attachment: fixed; }
:global(.primary) { background: var(--client-primary, #2563eb); }
:global(.secondary), :global(.link-button) { color: var(--client-primary, #2563eb); }
:global(.brand-mark span), :global(.topbar b) { color: var(--client-primary, #2563eb); }
:global(.page-heading h1), :global(.placeholder-page h1) { color: var(--client-ink, #172033); }
</style>
