<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { invokeCommand } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
const form = reactive({ name: "py-env", targetPath: "", pythonPath: "", manager: "venv" });
const defaultDirectory = ref("");
const uvPath = ref("");
const nameEdited = ref(false);
const pathEdited = ref(false);
const finalPath = computed(() => {
  if (!form.targetPath || !form.name) return "";
  const separator = form.targetPath.includes("\\") ? "\\" : "/";
  return form.targetPath.replace(/[\\/]+$/, "") + separator + form.name;
});
const pythonOptions = computed(() => workspace.pythonVersions.map((entry) => {
  const marker = entry.lastIndexOf(" (");
  return marker > 0 && entry.endsWith(")") ? { version: entry.slice(0, marker), path: entry.slice(marker + 2, -1) } : { version: entry, path: entry };
}));

function uniqueName() {
  const names = new Set(workspace.venvs.map((item) => item.name.toLowerCase()));
  const base = "py-env";
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(base + "-" + index).toLowerCase()) index++;
  return base + "-" + index;
}

function regenerateDefaults() {
  nameEdited.value = false;
  pathEdited.value = false;
  form.name = uniqueName();
  form.targetPath = defaultDirectory.value;
}

async function create() {
  await workspace.createVenv(form);
  if (!workspace.error) regenerateDefaults();
}

async function refreshUv() {
  uvPath.value = (await invokeCommand<string | null>("get_uv_path")) || "";
}

onMounted(async () => {
  const [directory] = await Promise.all([
    invokeCommand<string>("get_default_virtual_environment_directory"),
    workspace.loadVenvs(),
    workspace.loadPythonVersions(),
    refreshUv(),
  ]);
  defaultDirectory.value = directory;
  regenerateDefaults();
});
</script>

<template>
  <section class="content">
    <div class="page-heading">
      <div><span class="eyebrow">// Virtual Environments</span><h1>虚拟环境</h1><p>使用 Python 标准库或 uv 创建和维护虚拟环境。</p></div>
      <button class="secondary" @click="Promise.all([workspace.loadVenvs(), workspace.loadPythonVersions()])">刷新</button>
    </div>
    <div class="workspace-columns">
      <article class="card form-card">
        <h2>创建环境</h2>
        <label>环境名称<div class="input-action"><input v-model="form.name" placeholder="py-env" @input="nameEdited = true" /><button class="secondary" type="button" @click="regenerateDefaults">生成默认值</button></div></label>
        <label>目标目录<input v-model="form.targetPath" placeholder="C:\\Users\\你的用户名\\venvs" @input="pathEdited = true" /></label>
        <p v-if="finalPath" class="hint">将创建到：{{ finalPath }}</p>
        <label>创建工具<select v-model="form.manager"><option value="venv">Python venv</option><option value="uv">uv</option></select></label>
        <div v-if="form.manager === 'uv'" class="uv-tools"><p class="hint">{{ uvPath ? '已检测到 uv：' + uvPath : '当前未检测到 uv，请前往“uv 管理”安装。' }}</p></div>
        <label>Python 路径（可选）<select v-model="form.pythonPath"><option value="">自动检测系统 Python</option><option v-for="item in pythonOptions" :key="item.path" :value="item.path">{{ item.version }} · {{ item.path }}</option></select></label>
        <p class="hint">留空时由程序自动选择系统 Python。</p>
        <button class="primary wide" :disabled="workspace.busy || !form.name || !form.targetPath || (form.manager === 'uv' && !uvPath)" @click="create">创建虚拟环境</button>
      </article>
      <article class="card">
        <div class="card-heading"><div><span class="eyebrow">Inventory</span><h2>已发现环境</h2></div><span>{{ workspace.venvs.length }} 个</span></div>
        <div v-if="!workspace.venvs.length" class="empty">未检测到 venv 环境</div>
        <div v-for="item in workspace.venvs" :key="item.path" class="environment-row"><div class="env-avatar">venv</div><div class="env-main"><strong>{{ item.name }}</strong><span>{{ item.path }}</span></div><div class="env-meta"><strong>{{ item.pythonVersion }}</strong><span>{{ item.manager }}</span></div><button class="text-danger" @click="workspace.deleteVenv(item.path)">删除</button></div>
      </article>
    </div>
  </section>
</template>
