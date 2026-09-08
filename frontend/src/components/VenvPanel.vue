<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { describeError, invokeCommand } from "@/lib/tauri";
import { chooseDirectory } from "@/lib/dialog";
import { useWorkspaceStore } from "@/stores/workspace";
import ConfirmDialog from "@/components/ConfirmDialog.vue";

const workspace = useWorkspaceStore();
const form = reactive({ name: "py-env", targetPath: "", pythonPath: "", manager: "venv" });
const defaultDirectory = ref("");
const scanDirectory = ref("");
const uvPath = ref("");
const showScanPanel = ref(false);
const confirmRequest = ref<{ title: string; message: string; confirmLabel: string; action: () => Promise<void> } | null>(null);
const searchQuery = ref("");
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
  form.name = uniqueName();
  form.targetPath = defaultDirectory.value;
}

const filteredVenvs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return workspace.venvs;
  return workspace.venvs.filter((item) => [item.name, item.path, item.manager, item.pythonVersion].some((value) => value.toLowerCase().includes(query)));
});

async function chooseTargetDirectory() {
  try {
    const selected = await chooseDirectory(form.targetPath);
    if (selected) form.targetPath = selected;
  } catch (cause) { workspace.error = describeError(cause, "选择目标目录失败"); }
}

async function chooseScanDirectory() {
  try {
    const selected = await chooseDirectory(scanDirectory.value);
    if (selected) scanDirectory.value = selected;
  } catch (cause) { workspace.error = describeError(cause, "选择扫描目录失败"); }
}

async function create() {
  await workspace.createVenv(form);
  if (!workspace.error) regenerateDefaults();
}
function confirmDelete(path: string, name: string) {
  confirmRequest.value = { title: `删除虚拟环境“${name}”？`, message: "环境中的包和数据将被移除，此操作无法撤销。", confirmLabel: "确认删除", action: async () => { await workspace.deleteVenv(path); } };
}

async function refreshUv() {
  uvPath.value = (await invokeCommand<string | null>("get_uv_path")) || "";
}

async function scan() {
  showScanPanel.value = true;
  await workspace.loadVenvs(scanDirectory.value);
}

async function copyPath(path: string) {
  await navigator.clipboard.writeText(path);
  workspace.error = "";
  workspace.message = "环境路径已复制";
}
async function acceptConfirm() {
  const request = confirmRequest.value;
  confirmRequest.value = null;
  if (request) await request.action();
}

onMounted(async () => {
  try {
    const [directory] = await Promise.all([
      invokeCommand<string>("get_default_virtual_environment_directory"),
      workspace.loadVenvs(),
      workspace.loadPythonVersions(),
      refreshUv(),
    ]);
    defaultDirectory.value = directory;
    regenerateDefaults();
  } catch (cause) {
    workspace.error = describeError(cause, "读取虚拟环境设置失败");
    regenerateDefaults();
  }
});
</script>

<template>
  <section class="content">
    <div class="page-heading">
      <div><span class="eyebrow">// Virtual Environments</span><h1>虚拟环境</h1><p>使用 Python 标准库或 uv 创建和维护虚拟环境。</p></div>
      <div class="button-grid"><button class="secondary" :disabled="workspace.busy" @click="Promise.all([workspace.loadVenvs(), workspace.loadPythonVersions()])">刷新</button><button class="secondary" :disabled="workspace.busy" @click="showScanPanel = !showScanPanel">{{ showScanPanel ? "收起扫描" : "扫描目录" }}</button></div>
    </div>
    <div class="workspace-columns">
      <article class="card form-card">
        <h2>创建环境</h2>
        <label>环境名称<div class="input-action"><input v-model="form.name" placeholder="py-env" /><button class="secondary" type="button" :disabled="workspace.busy" @click="regenerateDefaults">生成默认值</button></div></label>
        <label>目标目录<div class="input-action"><input v-model="form.targetPath" placeholder="C:\\Users\\你的用户名\\venvs" /><button class="secondary" type="button" :disabled="workspace.busy" @click="chooseTargetDirectory">选择</button></div><small class="hint">推荐目录：{{ defaultDirectory || "读取中…" }}</small></label>
        <p v-if="finalPath" class="hint">将创建到：{{ finalPath }}</p>
        <label>创建工具<select v-model="form.manager"><option value="venv">Python venv</option><option value="uv">uv</option></select></label>
        <div v-if="form.manager === 'uv'" class="uv-tools"><p class="hint">{{ uvPath ? '已检测到 uv：' + uvPath : '当前未检测到 uv，请前往“uv 管理”安装。' }}</p></div>
        <label>{{ form.manager === 'uv' ? 'Python 版本或路径（可选）' : 'Python 路径（可选）' }}<input v-model="form.pythonPath" list="python-options" :placeholder="form.manager === 'uv' ? '留空由 uv 自动选择并下载' : '留空时自动检测系统 Python'" /></label>
        <datalist id="python-options"><option v-for="item in pythonOptions" :key="item.path" :value="item.path">{{ item.version }}</option></datalist>
        <p class="hint">{{ form.manager === 'uv' ? 'uv 模式无需系统 Python；可填写 3.13、3.13.5 或解释器路径，找不到时 uv 会自动下载。' : '留空时由程序自动选择系统 Python。' }}</p>
        <button class="primary wide" :disabled="workspace.busy || !form.name || !form.targetPath || (form.manager === 'uv' && !uvPath)" @click="create">创建虚拟环境</button>
      </article>
      <article class="card">
        <div class="scan-toolbar"><div class="card-heading"><div><span class="eyebrow">Inventory</span><h2>已发现环境</h2></div><span>{{ workspace.venvs.length }} 个</span></div><button class="link-button" @click="showScanPanel = !showScanPanel">{{ showScanPanel ? "关闭" : "指定目录" }}</button></div>
        <div v-if="showScanPanel" class="scan-panel"><div class="input-action"><input v-model="scanDirectory" placeholder="项目目录或 .venv 完整路径" /><button class="secondary" type="button" :disabled="workspace.busy" @click="chooseScanDirectory">选择</button></div><p class="hint">扫描会保留固定目录和已登记环境，也会识别直接指定的 .venv。</p><button class="secondary" :disabled="workspace.busy || !scanDirectory" @click="scan">开始扫描</button></div>
        <label class="list-search"><span>搜索环境</span><input v-model="searchQuery" placeholder="名称、路径或工具" /></label>
        <div v-if="!workspace.venvs.length" class="empty empty-action"><span>未检测到 venv 环境</span><small>可使用左侧表单创建，或指定一个项目目录进行扫描。</small><button class="link-button" @click="showScanPanel = true">指定扫描目录</button></div>
        <div v-else-if="!filteredVenvs.length" class="empty">没有匹配的环境</div>
        <div v-for="item in filteredVenvs" :key="item.path" class="environment-row"><div class="env-avatar">venv</div><div class="env-main"><strong>{{ item.name }}</strong><span>{{ item.path }}</span></div><div class="env-meta"><strong>{{ item.pythonVersion }}</strong><span>{{ item.manager }}</span></div><button class="copy-button" :title="`复制 ${item.path}`" :aria-label="`复制 ${item.name} 路径`" @click="copyPath(item.path)">复制</button><button class="text-danger" :disabled="workspace.busy" @click="confirmDelete(item.path, item.name)">删除</button></div>
      </article>
    </div>
  </section>
  <ConfirmDialog v-if="confirmRequest" :open="true" :title="confirmRequest.title" :message="confirmRequest.message" :confirm-label="confirmRequest.confirmLabel" @confirm="acceptConfirm" @cancel="confirmRequest = null" />
</template>
