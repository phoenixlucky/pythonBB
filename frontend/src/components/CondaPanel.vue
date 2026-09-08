<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { invokeCommand } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspace";
import ConfirmDialog from "@/components/ConfirmDialog.vue";

const workspace = useWorkspaceStore();
const form = reactive({ name: "", mode: "python", sourceName: "", targetPythonVersion: "", clonePython: true, clonePackages: true, pythonVersion: "3.13", channel: "conda-forge", packages: "" });
const exportForm = reactive({ name: "", path: "" });
const importForm = reactive({ path: "", name: "" });
const exportDirectory = ref("");
const showAdvanced = ref(false);
const nameEdited = ref(false);
const confirmRequest = ref<{ title: string; message: string; confirmLabel: string; action: () => Promise<void> } | null>(null);

function versionName(version: string) {
  const digits = version.match(/\d+(?:\.\d+){0,2}/)?.[0]?.replaceAll(".", "") || "313";
  return `py${digits}`;
}

function uniqueName(base: string) {
  const names = new Set(workspace.conda.map((item) => item.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let index = 2;
  while (names.has(`${base}-${index}`.toLowerCase())) index++;
  return `${base}-${index}`;
}

function regenerateName() {
  nameEdited.value = false;
  form.name = uniqueName(form.mode === "clone" && form.sourceName ? `${form.sourceName}-copy` : versionName(form.pythonVersion));
}

onMounted(async () => {
  await workspace.loadConda();
  if (!nameEdited.value) regenerateName();
});

async function create() {
  await workspace.createConda({ ...form, packages: form.packages.split(",").map((item) => item.trim()).filter(Boolean) });
}
function confirmDelete(name: string) {
  confirmRequest.value = { title: `删除 Conda 环境“${name}”？`, message: "环境中的包和数据将被移除，此操作无法撤销。", confirmLabel: "确认删除", action: async () => { await workspace.deleteConda(name); } };
}
async function exportEnvironment() {
  if (exportForm.name && exportForm.path) confirmRequest.value = { title: `导出环境“${exportForm.name}”？`, message: `目标文件：${exportForm.path}。如果文件已存在，可能会被覆盖。`, confirmLabel: "确认导出", action: async () => { await workspace.exportConda(exportForm); } };
}
async function exportAllEnvironments() {
  if (exportDirectory.value) confirmRequest.value = { title: "导出全部 Conda 环境？", message: `目标目录：${exportDirectory.value}。继续后会写入多个环境文件。`, confirmLabel: "确认导出", action: async () => { await workspace.exportAllConda(exportDirectory.value); } };
}
async function importEnvironment() { if (importForm.path) await workspace.importConda({ path: importForm.path, name: importForm.name || undefined }); }
async function autoExportPath() { if (exportForm.name) exportForm.path = await invokeCommand<string>("get_default_conda_export_path", { name: exportForm.name }); }
async function autoExportDirectory() { exportDirectory.value = await invokeCommand<string>("get_default_conda_export_directory"); }
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
</script>

<template>
  <section class="content">
    <div class="page-heading"><div><span class="eyebrow">// Conda</span><h1>Conda 环境</h1><p>创建、克隆、删除以及导入导出 Conda 环境。</p></div><button class="secondary" :disabled="workspace.busy" @click="workspace.loadConda">刷新</button></div>
    <div class="workspace-columns">
      <article class="card form-card"><h2>创建环境</h2><label>环境名称<div class="input-action"><input v-model="form.name" placeholder="py313" @input="nameEdited = true" /><button class="secondary" type="button" @click="regenerateName">生成默认名称</button></div></label><label>创建方式<select v-model="form.mode"><option value="python">按 Python 版本创建</option><option value="clone">克隆已有环境</option></select></label><label v-if="form.mode === 'clone'">源环境<select v-model="form.sourceName"><option value="">选择环境</option><option v-for="item in workspace.conda" :key="item.name" :value="item.name">{{ item.name }}</option></select></label><template v-if="form.mode === 'clone'"><label>目标 Python 版本（可选）<input v-model="form.targetPythonVersion" placeholder="留空保持源版本" /></label><label class="switch-row"><input type="checkbox" v-model="form.clonePython" />克隆 Python</label><label class="switch-row"><input type="checkbox" v-model="form.clonePackages" />克隆环境包</label></template><template v-else><label>Python 版本<input v-model="form.pythonVersion" placeholder="3.13" /></label><label>软件源<select v-model="form.channel"><option value="conda-forge">conda-forge</option><option value="defaults">defaults</option></select></label><label>额外包（逗号分隔）<input v-model="form.packages" placeholder="numpy, pandas" /></label></template><button class="primary wide" :disabled="workspace.busy || !form.name" @click="create">{{ workspace.busy ? "执行中…" : "创建环境" }}</button></article>
      <article class="card"><div class="card-heading"><div><span class="eyebrow">Inventory</span><h2>已发现环境</h2></div><span>{{ workspace.conda.length }} 个</span></div><div v-if="!workspace.conda.length" class="empty empty-action"><span>未检测到 Conda 环境</span><small>可以直接使用左侧表单创建，或先完成初始化配置。</small></div><div v-for="item in workspace.conda" :key="item.prefix" class="environment-row"><div class="env-avatar">py</div><div class="env-main"><strong>{{ item.name }}</strong><span>{{ item.prefix }}</span></div><div class="env-meta"><strong>{{ item.python }}</strong><span>{{ item.packageCount }} 个包</span></div><button class="copy-button" :title="`复制 ${item.prefix}`" :aria-label="`复制 ${item.name} 路径`" @click="copyPath(item.prefix)">复制</button><button v-if="item.name !== 'base'" class="text-danger" @click="confirmDelete(item.name)">删除</button></div></article>
    </div>
      <article class="card tools-card"><div class="button-row"><button class="link-button" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? "收起" : "展开" }} 导入导出</button><button class="secondary" @click="workspace.upgradeConda">升级 Conda</button></div><div v-if="showAdvanced" class="inline-tools"><div><select v-model="exportForm.name"><option value="">选择导出环境</option><option v-for="item in workspace.conda" :key="item.name" :value="item.name">{{ item.name }}</option></select><input v-model="exportForm.path" placeholder="导出文件路径 .yml" /><button class="secondary" @click="autoExportPath">自动生成</button><button class="secondary" @click="exportEnvironment">导出</button></div><div><input v-model="exportDirectory" placeholder="全部环境导出目录" /><button class="secondary" @click="autoExportDirectory">自动生成</button><button class="secondary" @click="exportAllEnvironments">全部导出</button></div><div><input v-model="importForm.path" placeholder="YAML 文件路径" /><input v-model="importForm.name" placeholder="可选环境名" /><button class="secondary" @click="importEnvironment">导入</button></div></div></article>
  </section>
  <ConfirmDialog v-if="confirmRequest" :open="true" :title="confirmRequest.title" :message="confirmRequest.message" :confirm-label="confirmRequest.confirmLabel" @confirm="acceptConfirm" @cancel="confirmRequest = null" />
</template>
