<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { invokeCommand } from "@/lib/tauri";
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
const form = reactive({ major: "3.13", channel: "conda-forge", environment: "", version: "" });
const available = ref<string[]>([]);
const searching = ref(false);
const error = ref("");
const pythonEntries = computed(() => workspace.pythonVersions.map((entry) => {
  const marker = entry.lastIndexOf(" (");
  return marker > 0 && entry.endsWith(")") ? { version: entry.slice(0, marker), path: entry.slice(marker + 2, -1) } : { version: entry, path: entry };
}));

async function search(force = false) {
  searching.value = true;
  error.value = "";
  available.value = [];
  try {
    available.value = await invokeCommand<string[]>(force ? "refresh_conda_python_versions" : "search_conda_python_versions", { version: form.major.trim(), channel: form.channel });
    if (!available.value.length) error.value = "没有找到可用版本，请检查大版本号或软件源。";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    searching.value = false;
  }
}

async function upgrade() {
  if (form.environment && form.version) await workspace.startPythonUpgrade(form.environment, form.version, form.channel);
}

onMounted(() => {
  if (!workspace.pythonVersions.length) void workspace.loadPythonVersions();
});
</script>

<template>
  <section class="content">
    <div class="page-heading">
      <div><span class="eyebrow">// Python</span><h1>Python 版本</h1><p>扫描本机解释器，或查询并升级 Conda 环境中的 Python。</p></div>
      <button class="secondary" @click="workspace.loadPythonVersions">重新扫描</button>
    </div>
    <div v-if="error" class="error-banner">{{ error }}</div>
    <div class="workspace-columns">
      <article class="card">
        <div class="card-heading"><div><span class="eyebrow">Installed</span><h2>本机 Python</h2></div><span>{{ pythonEntries.length }} 个</span></div>
        <div v-if="!pythonEntries.length" class="empty">未发现可用 Python</div>
        <div v-for="item in pythonEntries" :key="item.path" class="python-row"><span class="env-avatar">py</span><div class="python-copy"><strong>Python {{ item.version }}</strong><span :title="item.path">{{ item.path }}</span></div></div>
      </article>
      <article class="card form-card">
        <h2>Conda Python 升级</h2>
        <label>目标环境<select v-model="form.environment"><option value="">选择环境</option><option v-for="item in workspace.conda" :key="item.name" :value="item.name">{{ item.name }}</option></select></label>
        <label>大版本<input v-model="form.major" placeholder="3.13" /></label>
        <label>软件源<select v-model="form.channel"><option value="conda-forge">conda-forge</option><option value="defaults">defaults</option></select></label>
        <div class="button-grid"><button class="secondary" :disabled="searching" @click="search()">{{ searching ? "查询中…" : "查询可用版本" }}</button><button class="secondary" :disabled="searching" @click="search(true)">强制刷新</button></div>
        <select v-model="form.version"><option value="">选择目标版本</option><option v-for="version in available" :key="version" :value="version">{{ version }}</option></select>
        <button class="primary" :disabled="workspace.busy || !form.environment || !form.version" @click="upgrade">执行升级</button>
      </article>
    </div>
  </section>
</template>
