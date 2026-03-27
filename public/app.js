const state = {
  overview: null,
  conda: [],
  venvs: [],
  pythonVersionsLoaded: false,
  installedPackages: []
};

const elements = {
  statusPill: document.querySelector("#statusPill"),
  globalMessage: document.querySelector("#globalMessage"),
  heroNodeVersion: document.querySelector("#heroNodeVersion"),
  heroCondaState: document.querySelector("#heroCondaState"),
  overviewStats: document.querySelector("#overviewStats"),
  pythonVersionsList: document.querySelector("#pythonVersionsList"),
  pythonVersionCount: document.querySelector("#pythonVersionCount"),
  condaOverviewList: document.querySelector("#condaOverviewList"),
  condaEnvCount: document.querySelector("#condaEnvCount"),
  condaList: document.querySelector("#condaList"),
  condaInventoryMeta: document.querySelector("#condaInventoryMeta"),
  venvList: document.querySelector("#venvList"),
  venvInventoryMeta: document.querySelector("#venvInventoryMeta"),
  packageTargetSelect: document.querySelector("#packageTargetSelect"),
  installedPackageSelect: document.querySelector("#installedPackageSelect"),
  packageResults: document.querySelector("#packageResults"),
  packageResultMeta: document.querySelector("#packageResultMeta"),
  condaSourceSelect: document.querySelector("#condaSourceSelect"),
  condaExportSourceSelect: document.querySelector("#condaExportSourceSelect"),
  condaExportAutoPathButton: document.querySelector("#condaExportAutoPathButton"),
  condaExportBrowseButton: document.querySelector("#condaExportBrowseButton"),
  condaModeSelect: document.querySelector("#condaModeSelect"),
  condaPythonFields: document.querySelector("#condaPythonFields"),
  condaCloneFields: document.querySelector("#condaCloneFields"),
  condaSummary: document.querySelector("#condaSummary"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmCancelButton: document.querySelector("#confirmCancelButton"),
  confirmAcceptButton: document.querySelector("#confirmAcceptButton"),
  operationModal: document.querySelector("#operationModal"),
  operationEyebrow: document.querySelector("#operationEyebrow"),
  operationTitle: document.querySelector("#operationTitle"),
  operationMessage: document.querySelector("#operationMessage"),
  operationDetails: document.querySelector("#operationDetails"),
  operationCloseButton: document.querySelector("#operationCloseButton"),
  refreshInstalledPackagesButton: document.querySelector("#refreshInstalledPackagesButton"),
  upgradeAllPackagesButton: document.querySelector("#upgradeAllPackagesButton")
};

let confirmResolver = null;
let operationProgressTimer = null;

function setBusy(message) {
  elements.statusPill.textContent = "处理中";
  elements.globalMessage.textContent = message;
}

function setReady(message = "等待操作。") {
  elements.statusPill.textContent = "就绪";
  elements.globalMessage.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function askConfirm({ title, message, confirmText = "确认" }) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAcceptButton.textContent = confirmText;
  elements.confirmModal.classList.remove("hidden");

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(result) {
  elements.confirmModal.classList.add("hidden");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

function showOperationModal({ eyebrow = "Operation", title, message, details = "", closable = false }) {
  elements.operationEyebrow.textContent = eyebrow;
  elements.operationTitle.textContent = title;
  elements.operationMessage.textContent = message;
  elements.operationDetails.textContent = details;
  elements.operationCloseButton.disabled = !closable;
  elements.operationModal.classList.remove("hidden");
}

function scrollOperationDetailsToBottom() {
  if (elements.operationDetails) {
    elements.operationDetails.scrollTop = elements.operationDetails.scrollHeight;
  }
}

function updateOperationModal({ eyebrow, title, message, details, closable }) {
  if (eyebrow !== undefined) {
    elements.operationEyebrow.textContent = eyebrow;
  }
  if (title !== undefined) {
    elements.operationTitle.textContent = title;
  }
  if (message !== undefined) {
    elements.operationMessage.textContent = message;
  }
  if (details !== undefined) {
    elements.operationDetails.textContent = details;
    scrollOperationDetailsToBottom();
  }
  if (closable !== undefined) {
    elements.operationCloseButton.disabled = !closable;
  }
}

function closeOperationModal() {
  elements.operationModal.classList.add("hidden");
}

function clearOperationProgressTimer() {
  if (operationProgressTimer) {
    clearInterval(operationProgressTimer);
    operationProgressTimer = null;
  }
}

function formatProgressDetails(steps, activeIndex, extraLines = []) {
  const lines = steps.map((step, index) => {
    if (index < activeIndex) {
      return `[已完成] ${step}`;
    }
    if (index === activeIndex) {
      return `[进行中] ${step}`;
    }
    return `[等待中] ${step}`;
  });

  if (extraLines.length) {
    lines.push("", ...extraLines);
  }

  return lines.join("\n");
}

function startOperationProgress({ eyebrow, title, message, steps, extraLines = [], stepIntervalMs = 1600 }) {
  clearOperationProgressTimer();

  let activeIndex = 0;
  showOperationModal({
    eyebrow,
    title,
    message,
    details: formatProgressDetails(steps, activeIndex, extraLines),
    closable: false
  });

  operationProgressTimer = setInterval(() => {
    activeIndex = Math.min(activeIndex + 1, steps.length - 1);
    updateOperationModal({
      details: formatProgressDetails(steps, activeIndex, extraLines)
    });
  }, stepIntervalMs);

  return {
    complete({ eyebrow: nextEyebrow = "Completed", title: nextTitle, message: nextMessage, details, closable = true }) {
      clearOperationProgressTimer();
      updateOperationModal({
        eyebrow: nextEyebrow,
        title: nextTitle,
        message: nextMessage,
        details,
        closable
      });
    },
    fail({ eyebrow: nextEyebrow = "Failed", title: nextTitle, message: nextMessage, details, closable = true }) {
      clearOperationProgressTimer();
      updateOperationModal({
        eyebrow: nextEyebrow,
        title: nextTitle,
        message: nextMessage,
        details,
        closable
      });
    }
  };
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 0;
  const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "请求失败");
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`请求超时（${timeoutMs}ms）`);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function switchPanel(panelName) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelName);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${panelName}`);
  });
}

function renderOverview() {
  const overview = state.overview;
  if (!overview) {
    return;
  }

  elements.heroNodeVersion.textContent = `Node ${overview.nodeVersion || "-"}`;
  elements.heroCondaState.textContent = overview.condaAvailable || overview.condaPath ? "Conda 已连接" : "Conda 未检测到";

  const stats = [
    ["平台", `${overview.platform || "-"} / ${overview.arch || "-"}`],
    ["当前目录", overview.currentDirectory || "-"],
    ["Pip", overview.pipVersion || "-"],
    ["主机", overview.hostname || "-"]
  ];
  if (overview.condaPath) {
    stats.push(["Conda 路径", overview.condaPath]);
  }

  elements.overviewStats.innerHTML = stats
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <span class="eyebrow">${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");

  const pythonVersions = overview.pythonVersions || [];
  elements.pythonVersionCount.textContent = String(pythonVersions.length);
  elements.pythonVersionsList.innerHTML = pythonVersions.length
    ? pythonVersions
        .map(
          (entry) => `
            <article class="list-item">
              <strong>Python ${escapeHtml(entry.version)}</strong>
              <span class="list-meta">${escapeHtml(entry.path)}</span>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>${state.pythonVersionsLoaded ? "未检测到 Python 版本" : "正在扫描 Python 版本..."}</strong></article>`;

  const condaEnvironments = overview.condaEnvironments || [];
  elements.condaEnvCount.textContent = String(condaEnvironments.length);
  elements.condaOverviewList.innerHTML = condaEnvironments.length
    ? condaEnvironments
        .map(
          (env) => `
            <article class="list-item">
              <strong>${escapeHtml(env.name)}</strong>
              <span class="list-meta">Python ${escapeHtml(env.pythonVersion)}</span>
              <span class="list-meta">${escapeHtml(env.path)}</span>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>${overview.condaPath ? "Conda 已连接" : "未检测到 Conda"}</strong><span class="list-meta">${overview.condaPath ? "当前未读取到环境列表。你仍然可以尝试创建新环境。" : "请先确认 conda 安装路径或系统环境变量。"}</span></article>`;
}

function renderCondaList() {
  elements.condaInventoryMeta.textContent = `${state.conda.length} 个环境`;
  const condaOptions = state.conda
    .map((env) => `<option value="${escapeHtml(env.name)}">${escapeHtml(env.name)} · Python ${escapeHtml(env.pythonVersion)}</option>`)
    .join("");
  elements.condaSourceSelect.innerHTML = condaOptions;
  elements.condaExportSourceSelect.innerHTML = condaOptions;

  elements.condaList.innerHTML = state.conda.length
    ? state.conda
        .map(
          (env) => `
            <article class="list-item">
              <strong>${escapeHtml(env.name)}</strong>
              <span class="list-meta">Python ${escapeHtml(env.pythonVersion)}</span>
              <span class="list-meta">${escapeHtml(env.path)}</span>
              <span class="list-meta">${env.base ? "base 环境不可删除" : ""}</span>
              <div class="list-actions">
                ${env.base ? "" : `<button class="ghost-button" data-delete-conda="${escapeHtml(env.name)}">删除</button>`}
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>${state.overview?.condaPath ? "Conda 已连接" : "没有检测到 Conda"}</strong><span class="list-meta">${state.overview?.condaPath ? "当前未读取到环境列表。你仍然可以尝试创建新环境。" : "请先确认 conda 安装路径或系统环境变量。"}</span></article>`;

  updateCondaSummary();
  void fillCondaExportPath();
}

function renderVenvs() {
  elements.venvInventoryMeta.textContent = `${state.venvs.length} 个环境`;
  elements.venvList.innerHTML = state.venvs.length
    ? state.venvs
        .map(
          (env) => `
            <article class="list-item">
              <strong>${escapeHtml(env.name)}</strong>
              <span class="list-meta">Python ${escapeHtml(env.pythonVersion)}</span>
              <span class="list-meta">${escapeHtml(env.path)}</span>
              <div class="list-actions">
                <button class="ghost-button" data-delete-venv="${escapeHtml(env.path)}">删除</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>没有检测到 venv</strong></article>`;
}

function refreshPackageTargets() {
  const targets = [{ label: "系统 Python", value: JSON.stringify({ type: "system" }) }];
  state.conda.forEach((env) => {
    targets.push({ label: `conda: ${env.name}`, value: JSON.stringify({ type: "conda", name: env.name, path: env.path }) });
  });
  state.venvs.forEach((env) => {
    targets.push({ label: `venv: ${env.name}`, value: JSON.stringify({ type: "venv", name: env.name, path: env.path }) });
  });
  elements.packageTargetSelect.innerHTML = targets
    .map((target) => `<option value='${escapeHtml(target.value)}'>${escapeHtml(target.label)}</option>`)
    .join("");
}

function renderInstalledPackageOptions() {
  elements.installedPackageSelect.innerHTML = state.installedPackages.length
    ? [`<option value="">请选择一个已安装包</option>`, ...state.installedPackages.map((pkg) => `<option value="${escapeHtml(pkg.name)}">${escapeHtml(pkg.name)} (${escapeHtml(pkg.version)})</option>`)].join("")
    : `<option value="">未读取到已安装包</option>`;
}

function renderInstalledPackageLoading(text = "正在加载已安装包...") {
  elements.installedPackageSelect.innerHTML = `<option value="">${escapeHtml(text)}</option>`;
}

function updateCondaSummary() {
  const form = document.querySelector("#condaCreateForm");
  const data = new FormData(form);
  const mode = data.get("mode");
  const name = data.get("name") || "<未命名>";
  const lines = [`目标环境: ${name}`];

  if (mode === "python") {
    const packages = String(data.get("packages") || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    lines.push("模式: 按 Python 版本创建");
    lines.push(`Python 版本: ${data.get("pythonVersion")}`);
    lines.push(`额外安装包: ${packages.length ? packages.join(", ") : "无"}`);
    lines.push("预计动作: 执行 conda create，并追加额外包参数。");
  } else {
    const clonePython = form.elements.clonePython.checked;
    const clonePackages = form.elements.clonePackages.checked;
    lines.push("模式: 基于已有环境创建");
    lines.push(`源环境: ${data.get("sourceName") || "<未选择>"}`);
    lines.push(`克隆内容: ${[clonePython ? "Python 版本" : "", clonePackages ? "已安装库" : ""].filter(Boolean).join(", ") || "未选择"}`);
    if (clonePython && clonePackages) {
      lines.push("预计动作: 使用 conda clone 完整复制。");
    } else if (clonePython) {
      lines.push("预计动作: 读取源环境 Python 版本并创建空环境。");
    } else if (clonePackages) {
      lines.push(`目标 Python 版本: ${data.get("targetPythonVersion")}`);
      lines.push(`导出策略: ${form.elements.explicitPackagesOnly.checked ? "仅显式安装包" : "完整环境依赖"}`);
      lines.push("预计动作: 导出环境 YAML，重写目标名称和 Python 版本后创建。");
    } else {
      lines.push("预计动作: 请至少选择一项克隆内容。");
    }
  }

  elements.condaSummary.textContent = lines.join("\n");
}

async function getDefaultCondaExportPath(sourceName) {
  const envName = String(sourceName || "").trim();
  if (!envName) {
    return "";
  }

  const result = await request(`/api/conda/environments/export/default-path?sourceName=${encodeURIComponent(envName)}`);
  return String(result.filePath || "").trim();
}

async function fillCondaExportPath({ force = false } = {}) {
  const exportForm = document.querySelector("#condaExportForm");
  if (!exportForm) {
    return "";
  }

  const input = exportForm.elements.filePath;
  const currentValue = String(input.value || "").trim();
  if (!force && currentValue) {
    return currentValue;
  }

  const nextPath = await getDefaultCondaExportPath(exportForm.elements.sourceName.value);
  input.value = nextPath;
  return nextPath;
}

async function loadOverview() {
  setBusy("正在加载系统信息...");
  state.overview = await request("/api/overview");
  state.conda = state.overview.condaEnvironments || [];
  renderOverview();
  renderCondaList();
  refreshPackageTargets();
  setReady("系统信息已刷新。");
}

async function loadCondaEnvironments(options = {}) {
  if (!options.silent) {
    setBusy("正在刷新 Conda 环境...");
  }

  const result = await request("/api/conda/environments");
  state.conda = result.environments || [];

  if (!state.overview) {
    state.overview = {};
  }
  state.overview.condaAvailable = result.condaAvailable;
  state.overview.condaPath = result.condaPath;
  state.overview.condaEnvironments = state.conda;

  renderOverview();
  renderCondaList();
  refreshPackageTargets();

  if (!options.silent) {
    setReady("Conda 环境已刷新。");
  }
}

async function loadPythonVersions() {
  try {
    const versions = await request("/api/python/versions");
    if (!state.overview) {
      state.overview = {};
    }
    state.overview.pythonVersions = versions;
    state.pythonVersionsLoaded = true;
    renderOverview();
    setReady("Python 版本已刷新。");
  } catch (error) {
    state.pythonVersionsLoaded = true;
    if (!state.overview) {
      state.overview = {};
    }
    state.overview.pythonVersions = [];
    renderOverview();
    setReady(`Python 版本扫描失败: ${error.message}`);
  }
}

async function loadVenvs(options = {}) {
  if (!options.silent) {
    setBusy("正在扫描虚拟环境...");
  }
  state.venvs = await request("/api/venvs");
  renderVenvs();
  refreshPackageTargets();
  if (!options.silent) {
    setReady("虚拟环境已刷新。");
  }
}

async function loadInstalledPackages(options = {}) {
  if (!options.silent) {
    setBusy("正在加载已安装包...");
  }

  const target = getSelectedTarget();
  if (!target) {
    state.installedPackages = [];
    renderInstalledPackageLoading("请先选择目标环境");
    if (!options.silent) {
      setReady("请先选择目标环境。");
    }
    return;
  }

  renderInstalledPackageLoading();

  try {
    state.installedPackages = await request("/api/packages/list", {
      method: "POST",
      timeoutMs: 12000,
      body: JSON.stringify({ target })
    });
    renderInstalledPackageOptions();
    if (!options.silent) {
      setReady(`已加载 ${state.installedPackages.length} 个包。`);
    }
  } catch (error) {
    state.installedPackages = [];
    renderInstalledPackageLoading("加载失败，点击“刷新包下拉”重试");
    if (!options.silent) {
      setReady(`包下拉加载失败: ${error.message}`);
    }
  }
}

async function createCondaEnvironment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const mode = data.get("mode");
  const payload = {
    name: String(data.get("name") || "").trim(),
    mode
  };

  if (mode === "python") {
    payload.pythonVersion = data.get("pythonVersion");
    payload.packages = String(data.get("packages") || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    payload.sourceName = data.get("sourceName");
    payload.clonePython = form.elements.clonePython.checked;
    payload.clonePackages = form.elements.clonePackages.checked;
    payload.targetPythonVersion = data.get("targetPythonVersion");
    payload.explicitPackagesOnly = form.elements.explicitPackagesOnly.checked;
  }

  setBusy(`正在创建环境 ${payload.name}...`);
  const result = await request("/api/conda/environments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  await loadCondaEnvironments({ silent: true });
  renderOverview();
  elements.globalMessage.textContent = result.message;
  setReady(result.message);
}

async function exportCondaEnvironment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const resolvedFilePath = String(data.get("filePath") || "").trim() || (await fillCondaExportPath({ force: true }));
  const payload = {
    sourceName: String(data.get("sourceName") || "").trim(),
    filePath: resolvedFilePath,
    explicitPackagesOnly: form.elements.explicitPackagesOnly.checked
  };

  setBusy(`正在导出 conda 环境 ${payload.sourceName}...`);
  const submitButton = form.querySelector('button[type="submit"]');
  const progress = startOperationProgress({
    eyebrow: "Exporting",
    title: "正在导出环境文件",
    message: `源环境：${payload.sourceName || "<未选择>"}`,
    steps: [
      "校验导出参数",
      `调用 Conda 导出${payload.explicitPackagesOnly ? "显式安装包" : "完整环境依赖"}`,
      "等待 Conda 返回环境配置",
      "写入 YAML 文件"
    ],
    extraLines: [
      `导出文件: ${payload.filePath || "<未填写>"}`,
      `导出策略: ${payload.explicitPackagesOnly ? "仅导出显式安装包" : "导出完整环境依赖"}`
    ]
  });

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request("/api/conda/environments/export", {
      method: "POST",
      timeoutMs: 300000,
      body: JSON.stringify(payload)
    });
    elements.globalMessage.textContent = result.message;
    setReady(result.message);
    progress.complete({
      title: "环境文件导出完成",
      message: `Conda 环境“${payload.sourceName}”已导出。`,
      details: [`结果: ${result.message}`, `输出文件: ${result.filePath || payload.filePath}`].join("\n")
    });
  } catch (error) {
    setReady(error.message);
    progress.fail({
      title: "环境文件导出失败",
      message: `Conda 环境“${payload.sourceName || "<未选择>"}”导出未完成。`,
      details: error.message
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function formatTaskOutput(output, fallbackMessage = "") {
  const text = String(output || "").trim();
  if (text) {
    return text;
  }
  return fallbackMessage;
}

async function runInstallPackageAction(payload = {}) {
  const target = getSelectedTarget();
  const packageName = String(payload.packageName || "").trim();
  const isUpgrade = Boolean(payload.upgrade);

  if (!packageName) {
    setReady("请输入包名。");
    elements.packageResults.textContent = "请输入包名后再执行该操作。";
    elements.packageResultMeta.textContent = "缺少包名";
    return;
  }

  setBusy(isUpgrade ? "正在升级包..." : "正在安装包...");
  showOperationModal({
    eyebrow: isUpgrade ? "Upgrading" : "Installing",
    title: isUpgrade ? "正在升级包" : "正在安装包",
    message: `${packageName} · ${target?.type || "unknown"}${target?.name ? ` / ${target.name}` : ""}`,
    details: "正在提交安装任务...",
    closable: false
  });

  try {
    const task = await request("/api/packages/install-task", {
      method: "POST",
      body: JSON.stringify({
        target,
        packageName,
        upgrade: isUpgrade
      })
    });

    let latestTask = task;
    let finished = false;

    while (!finished) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      latestTask = await request(`/api/packages/tasks/${encodeURIComponent(task.taskId)}`, {
        timeoutMs: 10000
      });

      updateOperationModal({
        details: formatTaskOutput(latestTask.output, latestTask.message)
      });

      finished = latestTask.status === "completed" || latestTask.status === "failed";
    }

    const finalDetails = formatTaskOutput(latestTask.output, latestTask.message);
    elements.packageResults.textContent = finalDetails;

    if (latestTask.status === "completed") {
      elements.packageResultMeta.textContent = "安装完成";
      elements.globalMessage.textContent = latestTask.message;
      setReady(latestTask.message || "包操作已完成。");
      updateOperationModal({
        eyebrow: "Completed",
        title: isUpgrade ? "包升级完成" : "包安装完成",
        message: latestTask.message,
        details: finalDetails,
        closable: true
      });
      await loadInstalledPackages({ silent: true });
      return;
    }

    elements.packageResultMeta.textContent = "安装失败";
    setReady(latestTask.message || "包安装失败");
    updateOperationModal({
      eyebrow: "Failed",
      title: isUpgrade ? "包升级失败" : "包安装失败",
      message: latestTask.message || "安装过程失败",
      details: finalDetails,
      closable: true
    });
    throw new Error(latestTask.message || "包安装失败");
  } catch (error) {
    updateOperationModal({
      eyebrow: "Failed",
      title: isUpgrade ? "包升级失败" : "包安装失败",
      message: error.message || "安装过程失败",
      details: error.message || "安装过程失败",
      closable: true
    });
    throw error;
  }
}

async function importCondaEnvironment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") || "").trim(),
    filePath: String(data.get("filePath") || "").trim(),
    pythonVersion: data.get("pythonVersion")
  };

  setBusy(`正在根据环境文件创建 ${payload.name}...`);
  const submitButton = form.querySelector('button[type="submit"]');
  const progress = startOperationProgress({
    eyebrow: "Importing",
    title: "正在根据环境文件创建环境",
    message: `目标环境：${payload.name || "<未填写>"}`,
    steps: [
      "校验环境文件路径",
      "读取并重写环境 YAML",
      "调用 Conda 创建新环境",
      "刷新环境列表"
    ],
    extraLines: [
      `环境文件: ${payload.filePath || "<未填写>"}`,
      `Python 版本: ${payload.pythonVersion || "使用环境文件中的版本"}`
    ]
  });

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request("/api/conda/environments/import", {
      method: "POST",
      timeoutMs: 300000,
      body: JSON.stringify(payload)
    });
    await loadCondaEnvironments({ silent: true });
    renderOverview();
    elements.globalMessage.textContent = result.message;
    setReady(result.message);
    progress.complete({
      title: "环境导入完成",
      message: `已根据环境文件创建环境“${payload.name}”。`,
      details: [`结果: ${result.message}`, `来源文件: ${result.sourceFile || payload.filePath}`].join("\n")
    });
  } catch (error) {
    setReady(error.message);
    progress.fail({
      title: "环境导入失败",
      message: `环境“${payload.name || "<未填写>"}”创建未完成。`,
      details: error.message
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function createVenv(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  setBusy("正在创建虚拟环境...");
  const result = await request("/api/venvs", {
    method: "POST",
    body: JSON.stringify({
      name: data.get("name"),
      targetPath: data.get("targetPath"),
      pythonPath: data.get("pythonPath")
    })
  });
  await loadVenvs();
  elements.globalMessage.textContent = result.message;
  setReady(result.message);
}

async function deleteConda(name) {
  const confirmed = await askConfirm({
    title: "删除 Conda 环境",
    message: `确定要删除环境“${name}”吗？此操作不可撤销。`,
    confirmText: "确认删除"
  });
  if (!confirmed) {
    return;
  }

  setBusy(`正在删除 conda 环境 ${name}...`);
  showOperationModal({
    eyebrow: "Deleting",
    title: "正在删除 Conda 环境",
    message: `目标环境：${name}`,
    details: `已提交删除请求。\n环境名称：${name}\n请等待 Conda 返回结果。`,
    closable: false
  });

  try {
    const result = await request(`/api/conda/environments/${encodeURIComponent(name)}`, { method: "DELETE" });
    await loadCondaEnvironments({ silent: true });
    renderOverview();
    elements.globalMessage.textContent = result.message;
    updateOperationModal({
      eyebrow: "Completed",
      title: "删除完成",
      message: `Conda 环境“${name}”已处理完成。`,
      details: result.message,
      closable: true
    });
    setReady(result.message);
  } catch (error) {
    setReady(error.message);
    updateOperationModal({
      eyebrow: "Failed",
      title: "删除失败",
      message: `Conda 环境“${name}”未能删除。`,
      details: error.message,
      closable: true
    });
  }
}

async function deleteVenv(targetPath) {
  const confirmed = await askConfirm({
    title: "删除虚拟环境",
    message: `确定要删除这个虚拟环境吗？\n${targetPath}`,
    confirmText: "确认删除"
  });
  if (!confirmed) {
    return;
  }
  setBusy(`正在删除虚拟环境 ${targetPath}...`);
  const result = await request(`/api/venvs?path=${encodeURIComponent(targetPath)}`, { method: "DELETE" });
  await loadVenvs();
  elements.globalMessage.textContent = result.message;
  setReady(result.message);
}

function getSelectedTarget() {
  if (!elements.packageTargetSelect.value) {
    return null;
  }
  return JSON.parse(elements.packageTargetSelect.value);
}

async function runPackageAction(action, payload = {}) {
  if (["install", "uninstall", "show", "latest-version"].includes(action) && !String(payload.packageName || "").trim()) {
    setReady("请输入包名。");
    elements.packageResults.textContent = "请输入包名后再执行该操作。";
    elements.packageResultMeta.textContent = "缺少包名";
    return;
  }

  if (action === "install") {
    await runInstallPackageAction(payload);
    return;
  }

  const actionMessageMap = {
    uninstall: "正在卸载包...",
    show: "正在读取包信息...",
    list: "正在列出包...",
    "latest-version": "正在查询 PyPI 最新版本...",
    "upgrade-pip": "正在升级 pip...",
    "upgrade-all": "正在批量升级环境中的全部包...",
    "install-requirements": "正在从 requirements 安装..."
  };
  const timeoutMap = {
    show: 12000,
    "latest-version": 7000,
    "upgrade-all": 300000
  };

  setBusy(actionMessageMap[action] || `正在执行包操作: ${action}`);
  const data = await request(`/api/packages/${action}`, {
    method: "POST",
    timeoutMs: timeoutMap[action],
    body: JSON.stringify({
      target: getSelectedTarget(),
      ...payload
    })
  });

  if (action === "list") {
    elements.packageResults.textContent = data.map((pkg) => `${pkg.name} (${pkg.version})`).join("\n");
    elements.packageResultMeta.textContent = `${data.length} 个包`;
  } else if (action === "show") {
    elements.packageResults.textContent = data.content;
    elements.packageResultMeta.textContent = "包信息";
  } else if (action === "latest-version") {
    const installedPackage = state.installedPackages.find((pkg) => pkg.name === data.packageName);
    const lines = [
      `包名: ${data.packageName}`,
      `PyPI 最新版本: ${data.latestVersion}`,
      `当前环境已安装: ${installedPackage ? installedPackage.version : "未安装"}`
    ];

    if (data.summary) {
      lines.push(`简介: ${data.summary}`);
    }
    if (data.homePage) {
      lines.push(`主页: ${data.homePage}`);
    }
    if (data.packageUrl) {
      lines.push(`PyPI: ${data.packageUrl}`);
    }

    elements.packageResults.textContent = lines.join("\n");
    elements.packageResultMeta.textContent = "最新版本";
  } else if (action === "upgrade-all") {
    elements.packageResults.textContent = data.summary || data.message;
    elements.packageResultMeta.textContent = `批量升级完成${typeof data.upgradedCount === "number" ? ` · ${data.upgradedCount} 个 pip 包` : ""}`;
    await loadInstalledPackages({ silent: true });
  } else {
    elements.packageResults.textContent = data.message;
    elements.packageResultMeta.textContent = "操作完成";
  }
  setReady("包操作已完成。");
}

function wireNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.panel));
  });
}

function wireConfirmModal() {
  elements.confirmCancelButton.addEventListener("click", () => closeConfirm(false));
  elements.confirmAcceptButton.addEventListener("click", () => closeConfirm(true));
  elements.confirmModal.addEventListener("click", (event) => {
    if (event.target === elements.confirmModal) {
      closeConfirm(false);
    }
  });
}

function wireOperationModal() {
  elements.operationCloseButton.addEventListener("click", () => {
    if (!elements.operationCloseButton.disabled) {
      closeOperationModal();
    }
  });
  elements.operationModal.addEventListener("click", (event) => {
    if (event.target === elements.operationModal && !elements.operationCloseButton.disabled) {
      closeOperationModal();
    }
  });
}

function wireCondaForm() {
  const form = document.querySelector("#condaCreateForm");
  const exportForm = document.querySelector("#condaExportForm");
  const importForm = document.querySelector("#condaImportForm");

  const toggleMode = () => {
    const isClone = elements.condaModeSelect.value === "clone";
    elements.condaPythonFields.classList.toggle("hidden", isClone);
    elements.condaCloneFields.classList.toggle("hidden", !isClone);
    updateCondaSummary();
  };

  elements.condaModeSelect.addEventListener("change", toggleMode);
  form.addEventListener("input", updateCondaSummary);
  form.addEventListener("submit", async (event) => {
    try {
      await createCondaEnvironment(event);
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  exportForm.addEventListener("submit", async (event) => {
    try {
      await exportCondaEnvironment(event);
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  exportForm.elements.sourceName.addEventListener("change", async () => {
    try {
      await fillCondaExportPath({ force: true });
    } catch (error) {
      setReady(error.message);
    }
  });

  elements.condaExportAutoPathButton.addEventListener("click", async () => {
    try {
      const filePath = await fillCondaExportPath({ force: true });
      if (filePath) {
        setReady(`已生成导出路径: ${filePath}`);
      }
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  elements.condaExportBrowseButton.addEventListener("click", async () => {
    try {
      const sourceName = exportForm.elements.sourceName.value;
      const currentValue = String(exportForm.elements.filePath.value || "").trim();
      const defaultPath = currentValue || (await getDefaultCondaExportPath(sourceName));

      if (!window.desktopAPI?.chooseCondaExportPath) {
        exportForm.elements.filePath.value = defaultPath;
        setReady("当前为网页模式，已填入自动生成路径；如需其他位置请直接修改。");
        return;
      }

      const result = await window.desktopAPI.chooseCondaExportPath(defaultPath);
      if (!result?.canceled && result?.filePath) {
        exportForm.elements.filePath.value = result.filePath;
        setReady(`已选择导出路径: ${result.filePath}`);
      }
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  importForm.addEventListener("submit", async (event) => {
    try {
      await importCondaEnvironment(event);
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  document.querySelector("#refreshCondaButton").addEventListener("click", async () => {
    try {
      await loadCondaEnvironments();
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  toggleMode();
  void fillCondaExportPath({ force: true });
}

function wireVenvForm() {
  document.querySelector("#venvCreateForm").addEventListener("submit", async (event) => {
    try {
      await createVenv(event);
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  document.querySelector("#refreshVenvButton").addEventListener("click", async () => {
    try {
      await loadVenvs();
    } catch (error) {
      alert(error.message);
    }
  });
}

function wirePackageActions() {
  const form = document.querySelector("#packageActionForm");

  elements.packageTargetSelect.addEventListener("change", () => {
    loadInstalledPackages({ silent: true });
  });

  elements.installedPackageSelect.addEventListener("change", () => {
    if (elements.installedPackageSelect.value) {
      form.packageName.value = elements.installedPackageSelect.value;
    }
  });

  document.querySelector("#refreshTargetsButton").addEventListener("click", async () => {
    try {
      await Promise.all([loadCondaEnvironments({ silent: true }), loadVenvs({ silent: true }), loadOverview()]);
      await loadInstalledPackages({ silent: true });
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  elements.refreshInstalledPackagesButton.addEventListener("click", () => loadInstalledPackages());

  document.querySelector("#installPackageButton").addEventListener("click", () =>
    runPackageAction("install", { packageName: form.packageName.value })
  );
  document.querySelector("#upgradePackageButton").addEventListener("click", () =>
    runPackageAction("install", { packageName: form.packageName.value, upgrade: true })
  );
  document.querySelector("#uninstallPackageButton").addEventListener("click", () =>
    runPackageAction("uninstall", { packageName: form.packageName.value })
  );
  document.querySelector("#listPackagesButton").addEventListener("click", () => runPackageAction("list"));
  document.querySelector("#showPackageInfoButton").addEventListener("click", () =>
    runPackageAction("show", { packageName: form.packageName.value })
  );
  document.querySelector("#latestPackageVersionButton").addEventListener("click", () =>
    runPackageAction("latest-version", { packageName: form.packageName.value })
  );
  document.querySelector("#upgradePipButton").addEventListener("click", () => runPackageAction("upgrade-pip"));
  elements.upgradeAllPackagesButton.addEventListener("click", async () => {
    const target = getSelectedTarget();
    if (!target) {
      setReady("请先选择目标环境。");
      return;
    }

    const confirmed = await askConfirm({
      title: "一键升级全部包",
      message:
        target.type === "conda"
          ? `确定要升级 conda 环境“${target.name}”中的全部库吗？\n将先执行 conda update --all，再升级 pip 包。`
          : "确定要升级当前目标环境中的全部 pip 包吗？",
      confirmText: "确认升级"
    });
    if (!confirmed) {
      return;
    }

    try {
      await runPackageAction("upgrade-all");
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });
  document.querySelector("#installRequirementsButton").addEventListener("click", () =>
    runPackageAction("install-requirements", { requirementsPath: form.requirementsPath.value })
  );
}

function wireListActions() {
  document.body.addEventListener("click", async (event) => {
    const condaName = event.target.dataset.deleteConda;
    const venvPath = event.target.dataset.deleteVenv;

    if (condaName) {
      try {
        await deleteConda(condaName);
      } catch (error) {
        setReady(error.message);
        alert(error.message);
      }
    }

    if (venvPath) {
      try {
        await deleteVenv(venvPath);
      } catch (error) {
        setReady(error.message);
        alert(error.message);
      }
    }
  });
}

async function bootstrap() {
  wireNavigation();
  wireConfirmModal();
  wireOperationModal();
  wireCondaForm();
  wireVenvForm();
  wirePackageActions();
  wireListActions();

  document.querySelector("#refreshOverviewButton").addEventListener("click", async () => {
    try {
      await loadOverview();
    } catch (error) {
      alert(error.message);
    }
  });

  try {
    await loadOverview();
    loadCondaEnvironments({ silent: true }).catch((error) => setReady(`Conda 环境刷新失败: ${error.message}`));
    loadVenvs({ silent: true }).catch((error) => setReady(`虚拟环境扫描失败: ${error.message}`));
    loadInstalledPackages({ silent: true });
    loadPythonVersions();
  } catch (error) {
    setReady(error.message);
    alert(error.message);
  }
}

bootstrap();
