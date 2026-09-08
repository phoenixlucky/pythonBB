<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { invokeCommand } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
const status = reactive({ path: "", version: "" });
const uvPaths = ref<string[]>([]);
const uvEnvironments = computed(() => workspace.venvs.filter((item) => item.manager === "uv"));
const form = reactive({ version: "", installDirectory: "" });
const loading = ref(false);
const confirmingUninstall = ref(false);

async function refresh() {
  loading.value = true;
  try {
    status.path = (await invokeCommand<string | null>("get_uv_path")) || "";
    uvPaths.value = await invokeCommand<string[]>("get_uv_paths");
    status.version = (await invokeCommand<string | null>("get_uv_version")) || "";
    if (!form.installDirectory) form.installDirectory = await invokeCommand<string>("get_uv_default_directory");
  } catch (cause) {
    workspace.error = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
}

async function install() {
  const task = await workspace.installUv(form.version, form.installDirectory);
  if (task?.status === "completed") await refresh();
}

async function uninstall() {
  confirmingUninstall.value = false;
  const task = await workspace.uninstallUv();
  if (task?.status === "completed") await refresh();
}

onMounted(refresh);
</script>

<template>
  <section class="content">
    <div class="page-heading">
      <div><span class="eyebrow">// uv Manager</span><h1>uv 管理</h1><p>独立管理 uv 的检测、安装、指定版本安装和卸载。</p></div>
      <button class="secondary" :disabled="loading || workspace.busy" @click="refresh">重新检测</button>
    </div>
    <div class="workspace-columns">
      <article class="card form-card">
        <h2>安装 / 更新 uv</h2>
        <label>安装目录<input v-model="form.installDirectory" :disabled="workspace.busy" placeholder="输入完整安装目录" /></label>
        <label>指定版本（可选）<input v-model="form.version" placeholder="留空安装最新版，例如 0.8.17" /></label>
        <p class="hint">填写版本后会按指定版本安装；留空则安装最新版。安装需要联网。</p>
        <div class="button-grid"><button class="primary" :disabled="workspace.busy || loading" @click="install">{{ workspace.busy ? "处理中…" : status.path ? "安装 / 更新" : "一键安装" }}</button><button class="secondary" :disabled="workspace.busy || loading || !status.path" @click="confirmingUninstall = true">卸载 uv</button></div>
        <div v-if="confirmingUninstall" role="alert">
          <p>确定卸载 uv 和 uvx？已有虚拟环境会保留。</p>
          <div class="button-grid">
            <button class="secondary" :disabled="workspace.busy" @click="confirmingUninstall = false">取消</button>
            <button class="primary" :disabled="workspace.busy || loading" @click="uninstall">确认卸载</button>
          </div>
        </div>
      </article>
      <article class="card setup-card">
        <div class="card-heading"><div><span class="eyebrow">Status</span><h2>当前状态</h2></div><span>{{ status.path ? "已安装" : "未安装" }}</span></div>
        <div class="check-row"><span>版本</span><strong>{{ status.version || "-" }}</strong></div>
        <div class="check-row"><span>路径</span><strong class="path-value">{{ status.path || "未检测到 uv" }}</strong></div>
        <p class="hint">卸载按钮只移除本程序识别的用户级安装目录，不会删除系统或其他包管理器安装的 uv。</p>
      </article>
      <article class="card setup-card">
        <div class="card-heading"><div><span class="eyebrow">Installations</span><h2>已发现的 uv</h2></div><span>{{ uvPaths.length }} 个</span></div>
        <div v-if="!uvPaths.length" class="empty">未发现其他 uv 安装</div>
        <div v-for="path in uvPaths" :key="path" class="environment-row"><div class="env-avatar">uv</div><div class="env-main"><strong>uv</strong><span>{{ path }}</span></div></div>
      </article>
      <article class="card setup-card">
        <div class="card-heading"><div><span class="eyebrow">Virtual Environments</span><h2>uv 创建的环境</h2></div><span>{{ uvEnvironments.length }} 个</span></div>
        <div v-if="!uvEnvironments.length" class="empty">未发现 uv 虚拟环境</div>
        <div v-for="item in uvEnvironments" :key="item.path" class="environment-row"><div class="env-avatar">uv</div><div class="env-main"><strong>{{ item.name }}</strong><span>{{ item.path }}</span></div><div class="env-meta"><strong>{{ item.pythonVersion }}</strong><span>uv</span></div></div>
      </article>
    </div>
  </section>
</template>
