<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { describeError, invokeCommand } from "@/lib/tauri";
import { chooseDirectory } from "@/lib/dialog";
import { useAppStore } from "@/stores/app";
import { useWorkspaceStore } from "@/stores/workspace";

const app = useAppStore();
const workspace = useWorkspaceStore();
const status = ref<SetupStatus | null>(null);
const form = reactive({
  installPath: "",
  pythonVersion: "3.14",
  condaPackages: ["numpy", "pandas", "openpyxl"],
  pipPackages: ["openai", "loguru"],
});

const condaCatalog = [
  { id: "numpy", label: "NumPy", description: "数组与数值计算" },
  { id: "pandas", label: "Pandas", description: "表格数据处理" },
  { id: "openpyxl", label: "OpenPyXL", description: "Excel 文件读写" },
  { id: "matplotlib", label: "Matplotlib", description: "基础数据可视化" },
  { id: "pyarrow", label: "PyArrow", description: "Arrow 与 Parquet 数据" },
];
const pipCatalog = [
  { id: "openai", label: "OpenAI", description: "OpenAI Python SDK" },
  { id: "loguru", label: "Loguru", description: "简洁的日志工具" },
  { id: "streamlit", label: "Streamlit", description: "快速构建数据应用" },
  { id: "DrissionPage", label: "DrissionPage", description: "浏览器自动化与采集" },
  { id: "ipython-sql", label: "IPython SQL", description: "Notebook 中执行 SQL" },
  { id: "SQLAlchemy", label: "SQLAlchemy", description: "数据库 ORM 与连接" },
  { id: "aiomysql", label: "aiomysql", description: "异步 MySQL 客户端" },
  { id: "PyMySQL", label: "PyMySQL", description: "纯 Python MySQL 客户端" },
  { id: "mysql-connector-python", label: "MySQL Connector", description: "MySQL 官方连接器" },
  { id: "schedule", label: "Schedule", description: "轻量定时任务" },
  { id: "wei-data-shu[excel]", label: "wei-data-shu[excel]", description: "Excel 读写、拆分与合并" },
  { id: "wei-data-shu[database]", label: "wei-data-shu[database]", description: "MySQL 数据库支持" },
  { id: "wei-data-shu[analysis]", label: "wei-data-shu[analysis]", description: "文本分析、词云、趋势预测与数据分析" },
  { id: "wei-data-shu[excel-client]", label: "wei-data-shu[excel-client]", description: "通过本机 Excel 应用操作工作簿和宏" },
];
const steps = [
  { label: "检测电脑上的 Conda", progress: 10 },
  { label: "下载并安装最新版 Miniconda", progress: 30 },
  { label: "查询 conda-forge 最新 Python", progress: 55 },
  { label: "创建首个 Conda 环境", progress: 70 },
  { label: "安装选择的 Conda 与 pip 库", progress: 90 },
];

interface SetupStatus {
  recommendedInstallPath: string;
  condaAvailable: boolean;
  condaVersion?: string;
  basePythonVersion?: string;
  rootPrefix?: string;
  environmentCount: number;
}

function toggleAll(type: "conda" | "pip") {
  const catalog = type === "conda" ? condaCatalog : pipCatalog;
  const selected = type === "conda" ? form.condaPackages : form.pipPackages;
  const next = selected.length === catalog.length ? [] : catalog.map((item) => item.id);
  if (type === "conda") form.condaPackages = next;
  else form.pipPackages = next;
}

async function refresh() {
  try {
    status.value = await invokeCommand<SetupStatus>("get_setup_status");
    if (!form.installPath) form.installPath = status.value.recommendedInstallPath;
    await Promise.all([app.refresh().catch(() => undefined), workspace.refreshAll().catch(() => undefined)]);
  } catch (cause) {
    workspace.error = describeError(cause, "检测初始化状态失败");
  }
}

async function initialize() {
  await workspace.startSetup({ installPath: form.installPath, pythonVersion: form.pythonVersion, condaPackages: form.condaPackages, pipPackages: form.pipPackages });
  if (!workspace.error) await refresh();
}

async function chooseInstallDirectory() {
  try {
    const selected = await chooseDirectory(form.installPath);
    if (selected) form.installPath = selected;
  } catch (cause) { workspace.error = describeError(cause, "选择 Miniconda 安装目录失败"); }
}

async function upgradeConda() {
  const task = await workspace.upgradeConda();
  if (task?.status === "completed") await refresh();
}

onMounted(refresh);
</script>

<template>
  <section class="content">
    <div class="page-heading"><div><span class="eyebrow">// First-run Setup</span><h1>新电脑初始化配置</h1><p>检测现有 Conda；缺失时安装最新版 Miniconda，再创建首个 Python 开发环境。</p></div><button class="secondary" :disabled="workspace.busy" @click="refresh">重新检测</button></div>
    <div class="setup-layout">
      <article class="card form-card accent-card">
        <div class="card-badge-row"><span class="card-badge">One-click Setup</span><span class="card-badge subtle">conda-forge</span></div>
        <div class="card-heading"><div><h2>安装 Miniconda 并创建首个环境</h2></div><span>{{ status?.condaAvailable ? '已检测到 Conda · ' + status.environmentCount + ' 个环境' : '等待检测' }}</span></div>
        <p class="setup-intro">适用于新电脑。程序会检测现有 Conda，缺失时静默安装 Miniconda，并按选择的 Python 版本创建环境。</p>
        <div class="form-slab"><label>Miniconda 安装目录<div class="input-action"><input v-model="form.installPath" required :disabled="workspace.busy" /><button class="secondary" type="button" :disabled="workspace.busy" @click="chooseInstallDirectory">选择</button></div></label><div class="setup-facts"><div><span>环境命名</span><strong>按版本自动生成，如 py314</strong></div><div><span>软件源</span><strong>conda-forge</strong></div><div><span>基础组件</span><strong>Python + ipykernel</strong></div></div></div>
        <label>Python 版本<select v-model="form.pythonVersion"><option value="3.14">3.14（推荐）</option><option value="3.13">3.13</option><option value="3.12">3.12</option><option value="3.11">3.11</option><option value="3.10">3.10</option></select></label>
        <div class="setup-package-section"><div class="card-heading"><div><h3>Conda 常用库</h3><p>适合科学计算和数据文件处理，由 conda-forge 安装。</p></div><button class="secondary mini-button" type="button" :disabled="workspace.busy" @click="toggleAll('conda')">全选 / 清空</button></div><div class="package-choice-grid"><label v-for="item in condaCatalog" :key="item.id" class="package-choice"><input v-model="form.condaPackages" type="checkbox" :value="item.id" :disabled="workspace.busy" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span></label></div></div>
        <div class="setup-package-section"><div class="card-heading"><div><h3>pip 常用库</h3><p>环境创建完成后安装，可按需选择。</p></div><button class="secondary mini-button" type="button" :disabled="workspace.busy" @click="toggleAll('pip')">全选 / 清空</button></div><div class="package-choice-grid"><label v-for="item in pipCatalog" :key="item.id" class="package-choice"><input v-model="form.pipPackages" type="checkbox" :value="item.id" :disabled="workspace.busy" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span></label></div></div>
        <button class="primary wide" :disabled="workspace.busy || !form.installPath" @click="initialize">{{ workspace.busy ? '初始化中…' : '开始初始化' }}</button>
      </article>
      <div class="aside-stack">
        <article class="card setup-card"><div class="card-heading"><div><span class="eyebrow">System Maintenance</span><h2>Miniconda 维护</h2></div><span>{{ status?.condaAvailable ? '已连接' : '未检测到' }}</span></div><div class="maintenance-kv"><span>Conda 版本</span><strong>{{ status?.condaVersion || '-' }}</strong><span>base Python</span><strong>{{ status?.basePythonVersion || '-' }}</strong><span>安装目录</span><strong>{{ status?.rootPrefix || '-' }}</strong><span>已登记环境</span><strong>{{ status?.environmentCount ?? 0 }}</strong></div><p class="maintenance-note">{{ status?.condaAvailable ? '只更新 base 中的 Conda 核心包，不修改已有业务环境；升级前会自动备份 base 配置。' : '请先完成 Miniconda 初始化安装。' }}</p><button class="secondary wide" :disabled="workspace.busy || !status?.condaAvailable" @click="upgradeConda">检查并无损升级</button></article>
        <article class="card setup-card"><div class="card-heading"><div><h2>执行步骤</h2></div><span>{{ workspace.currentTask?.progress || 0 }}%</span></div><div class="setup-progress"><span :style="{ width: (workspace.currentTask?.progress || 0) + '%' }"></span></div><ol class="setup-steps"><li v-for="step in steps" :key="step.label" :class="{ active: workspace.currentTask?.status === 'running' && (workspace.currentTask?.progress || 0) <= step.progress, complete: workspace.currentTask?.status === 'completed' || (workspace.currentTask?.status === 'running' && (workspace.currentTask?.progress || 0) > step.progress) }">{{ step.label }}</li></ol></article>
      </div>
    </div>
  </section>
</template>
