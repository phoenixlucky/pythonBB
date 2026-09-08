<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { describeError, invokeCommand } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
const form = reactive({ major: "3.14", channel: "conda-forge", environment: "", version: "" });
const available = ref<string[]>([]);
const selectedPath = ref("");
const searching = ref(false);
const confirmingUninstall = ref(false);
const error = ref("");
const pythonEntries = computed(() => workspace.pythonVersions.map((entry) => {
  const marker = entry.lastIndexOf(" (");
  return marker > 0 && entry.endsWith(")") ? { version: entry.slice(0, marker), path: entry.slice(marker + 2, -1) } : { version: entry, path: entry };
}));
const selectedEntry = computed(() => pythonEntries.value.find((entry) => entry.path === selectedPath.value));
const majorVersions = ["3.14", "3.13", "3.12", "3.11", "3.10", "3.9"];

watch(pythonEntries, (entries) => {
  if (!entries.some((entry) => entry.path === selectedPath.value)) selectedPath.value = entries[0]?.path || "";
}, { immediate: true });

async function search(force = false) {
  searching.value = true;
  error.value = "";
  available.value = [];
  try {
    available.value = await invokeCommand<string[]>(force ? "refresh_conda_python_versions" : "search_conda_python_versions", { version: form.major, channel: form.channel });
    if (!available.value.length) error.value = "没有找到可用版本，请检查大版本号或软件源。";
  } catch (cause) {
    error.value = describeError(cause, "查询 Conda Python 版本失败");
  } finally {
    searching.value = false;
  }
}

async function upgrade() {
  if (form.environment && form.version) await workspace.startPythonUpgrade(form.environment, form.version, form.channel);
}

async function uninstallSelected() {
  if (!selectedPath.value) return;
  confirmingUninstall.value = false;
  await workspace.uninstallPython(selectedPath.value);
}

async function upgradeSelected() {
  if (selectedPath.value) await workspace.startSystemPythonUpgrade(selectedPath.value);
}

onMounted(() => {
  if (!workspace.pythonVersions.length) void workspace.loadPythonVersions();
});
</script>

<template>
  <section class="content">
    <div class="page-heading">
      <div><span class="eyebrow">// Python</span><h1>Python 版本</h1><p>扫描本机解释器，按版本查询 Conda 包，并管理已登记的 Python 环境。</p></div>
      <button class="secondary" @click="workspace.loadPythonVersions">重新扫描</button>
    </div>
    <div v-if="error || workspace.error" class="error-banner">{{ error || workspace.error }}</div>
    <div class="workspace-columns">
      <article class="card">
        <div class="card-heading"><div><span class="eyebrow">Installed</span><h2>本机 Python</h2></div><span>{{ pythonEntries.length }} 个</span></div>
        <label>选择要管理的版本
          <select v-model="selectedPath">
            <option value="">选择 Python 版本</option>
            <option v-for="item in pythonEntries" :key="item.path" :value="item.path">Python {{ item.version }} · {{ item.path }}</option>
          </select>
        </label>
        <div v-if="selectedEntry" class="selected-runtime">
          <div class="python-row selected-python"><span class="env-avatar">py</span><div class="python-copy"><strong>Python {{ selectedEntry.version }}</strong><span :title="selectedEntry.path">{{ selectedEntry.path }}</span></div></div>
          <div class="button-grid"><button class="secondary" :disabled="workspace.busy" @click="upgradeSelected">升级系统 Python</button><button class="secondary danger-action" :disabled="workspace.busy" @click="confirmingUninstall = true">卸载选中版本</button></div>
          <p class="hint">仅支持 Windows 上由 Python.org/winget 管理的系统 Python；Conda、venv 和 pyenv 请使用各自的管理方式。</p>
        </div>
        <div v-if="confirmingUninstall" class="confirm-panel">
          <strong>确认卸载 Python {{ selectedEntry?.version }}？</strong>
          <p>仅支持由本程序识别的 Conda/venv 环境；系统安装的 Python 会安全拒绝，不会误删目录。</p>
          <div class="button-grid"><button class="secondary" @click="confirmingUninstall = false">取消</button><button class="primary danger-button" @click="uninstallSelected">确认卸载</button></div>
        </div>
        <div v-if="!pythonEntries.length" class="empty">未发现可用 Python</div>
        <div v-for="item in pythonEntries" :key="item.path" class="python-row compact-python-row" :class="{ 'selected-python-row': item.path === selectedPath }" @click="selectedPath = item.path"><span class="env-avatar">py</span><div class="python-copy"><strong>Python {{ item.version }}</strong><span :title="item.path">{{ item.path }}</span></div></div>
      </article>
      <article class="card form-card">
        <h2>Conda Python 升级</h2>
        <label>目标环境<select v-model="form.environment"><option value="">选择环境</option><option v-for="item in workspace.conda" :key="item.name" :value="item.name">{{ item.name }}</option></select></label>
        <label>大版本<select v-model="form.major"><option v-for="version in majorVersions" :key="version" :value="version">Python {{ version }}{{ version === "3.14" ? "（推荐）" : "" }}</option></select></label>
        <label>软件源<select v-model="form.channel"><option value="conda-forge">conda-forge</option><option value="defaults">defaults</option></select></label>
        <div class="button-grid"><button class="secondary" :disabled="searching" @click="search()">{{ searching ? "查询中…" : "查询可用版本" }}</button><button class="secondary" :disabled="searching" @click="search(true)">强制刷新</button></div>
        <select v-model="form.version"><option value="">选择目标版本</option><option v-for="version in available" :key="version" :value="version">{{ version }}</option></select>
        <button class="primary" :disabled="workspace.busy || !form.environment || !form.version" @click="upgrade">执行升级</button>
      </article>
    </div>
  </section>
</template>
