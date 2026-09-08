<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { chooseFile } from "@/lib/dialog";
import { useWorkspaceStore } from "@/stores/workspace";
import ConfirmDialog from "@/components/ConfirmDialog.vue";

const workspace = useWorkspaceStore();
const form = reactive({ targetKey: "", packageName: "", indexUrl: "https://pypi.org/simple", requirementsPath: "" });
const showAdvanced = ref(false);
const searchQuery = ref("");
const confirmRequest = ref<{ title: string; message: string; confirmLabel: string; action: () => Promise<void> } | null>(null);
const selectedTarget = computed(() => workspace.targets.find((target) => JSON.stringify(target) === form.targetKey));
const filteredPackages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return workspace.packages;
  return workspace.packages.filter((item) => `${item.name} ${item.version}`.toLowerCase().includes(query));
});

watch(() => workspace.targets, (targets) => {
  if (!form.targetKey && targets[0]) form.targetKey = JSON.stringify(targets[0]);
}, { immediate: true });

watch(selectedTarget, (target) => {
  if (target) void workspace.loadPackages(target);
});

async function action(actionName: string) {
  if (selectedTarget.value) {
    await workspace.packageAction({ target: selectedTarget.value, action: actionName, packageName: form.packageName, indexUrl: form.indexUrl, requirementsPath: form.requirementsPath });
  }
}

function uninstallPackage() {
  const target = selectedTarget.value;
  const packageName = form.packageName.trim();
  if (!target || !packageName) return;
  confirmRequest.value = {
    title: `卸载包“${packageName}”？`,
    message: `目标环境：${target.name || target.path || "当前环境"}。卸载后可重新安装，但当前环境中的依赖可能受到影响。`,
    confirmLabel: "确认卸载",
    action: async () => {
      await workspace.packageAction({ target: { ...target }, action: "uninstall", packageName, indexUrl: form.indexUrl, requirementsPath: form.requirementsPath });
    },
  };
}

async function chooseRequirementsFile() {
  try {
    const selected = await chooseFile(form.requirementsPath, [{ name: "Requirements 文件", extensions: ["txt", "in"] }]);
    if (selected) form.requirementsPath = selected;
  } catch (cause) { workspace.error = cause instanceof Error ? cause.message : String(cause); }
}

async function acceptConfirm() {
  const request = confirmRequest.value;
  confirmRequest.value = null;
  if (request) await request.action();
}
</script>

<template>
  <section class="content">
    <div class="page-heading">
      <div><span class="eyebrow">// Packages</span><h1>包管理</h1><p>通过目标环境的 pip 执行安装、升级、卸载和查询。</p></div>
      <button class="secondary" :disabled="workspace.busy || !selectedTarget" @click="selectedTarget && workspace.loadPackages(selectedTarget)">刷新包</button>
    </div>
    <div class="workspace-columns">
      <article class="card form-card">
        <h2>包操作</h2>
        <label>目标环境<select v-model="form.targetKey"><option value="" disabled>选择环境</option><option v-for="target in workspace.targets" :key="JSON.stringify(target)" :value="JSON.stringify(target)">{{ target.targetType }} / {{ target.name }}</option></select></label>
        <p v-if="selectedTarget" class="target-context">当前操作：<strong>{{ selectedTarget.targetType }} / {{ selectedTarget.name }}</strong></p>
        <label>包名<input v-model="form.packageName" placeholder="numpy" /></label>
        <div class="package-primary-actions">
          <button class="primary" :disabled="workspace.busy || !form.packageName" @click="action('install')">安装</button>
          <button class="secondary" :disabled="workspace.busy || !form.packageName" @click="action('upgrade')">升级</button>
          <button class="danger-action" :disabled="workspace.busy || !form.packageName" @click="uninstallPackage">卸载</button>
        </div>
        <details class="advanced-actions" :open="showAdvanced" @toggle="showAdvanced = ($event.target as HTMLDetailsElement).open">
          <summary>高级操作</summary>
          <div class="advanced-fields">
            <label>pip 源<input v-model="form.indexUrl" /></label>
            <label>requirements 路径<div class="input-action"><input v-model="form.requirementsPath" :disabled="workspace.busy" placeholder="requirements.txt" /><button class="secondary" type="button" :disabled="workspace.busy" @click="chooseRequirementsFile">选择</button></div></label>
            <div class="button-grid">
              <button class="secondary" :disabled="workspace.busy || !form.packageName" @click="action('show')">查看详情</button>
              <button class="secondary" :disabled="workspace.busy || !form.packageName" @click="action('latest')">查最新版本</button>
              <button class="secondary" :disabled="workspace.busy" @click="action('upgrade-pip')">升级 pip</button>
              <button class="secondary" :disabled="workspace.busy" @click="action('upgrade-all')">升级全部</button>
              <button class="secondary" :disabled="workspace.busy || !form.requirementsPath" @click="action('requirements')">安装 requirements</button>
            </div>
          </div>
        </details>
      </article>
      <article class="card">
        <div class="card-heading"><div><span class="eyebrow">Installed</span><h2>已安装包</h2></div><span>{{ filteredPackages.length }} / {{ workspace.packages.length }} 个</span></div>
        <label class="list-search"><span>搜索包</span><input v-model="searchQuery" placeholder="包名或版本" /></label>
        <div class="package-list">
          <div v-for="item in filteredPackages" :key="item.name" class="package-row"><strong>{{ item.name }}</strong><span>{{ item.version }}</span><button class="link-button" :disabled="workspace.busy" @click="form.packageName = item.name">选择</button></div>
          <div v-if="!workspace.packages.length" class="empty">{{ selectedTarget ? "暂无已安装包或尚未刷新" : "先选择目标环境" }}</div>
          <div v-else-if="!filteredPackages.length" class="empty">没有匹配的包</div>
        </div>
      </article>
    </div>
  </section>
  <ConfirmDialog v-if="confirmRequest" :open="true" :title="confirmRequest.title" :message="confirmRequest.message" :confirm-label="confirmRequest.confirmLabel" @confirm="acceptConfirm" @cancel="confirmRequest = null" />
</template>
