const state = {
  overview: null,
  conda: [],
  venvs: [],
  pythonVersionsLoaded: false
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
  packageResults: document.querySelector("#packageResults"),
  packageResultMeta: document.querySelector("#packageResultMeta"),
  condaSourceSelect: document.querySelector("#condaSourceSelect"),
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
  operationCloseButton: document.querySelector("#operationCloseButton")
};

let confirmResolver = null;

function setBusy(message) {
  elements.statusPill.textContent = "处理中";
  elements.globalMessage.textContent = message;
}

function setReady(message = "等待操作。") {
  elements.statusPill.textContent = "就绪";
  elements.globalMessage.textContent = message;
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
  }
  if (closable !== undefined) {
    elements.operationCloseButton.disabled = !closable;
  }
}

function closeOperationModal() {
  elements.operationModal.classList.add("hidden");
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
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

  elements.heroNodeVersion.textContent = `Node ${overview.nodeVersion}`;
  const hasConda = Boolean(overview.condaAvailable || overview.condaPath);
  elements.heroCondaState.textContent = hasConda ? "Conda 已连接" : "Conda 未检测到";

  const stats = [
    ["平台", `${overview.platform} / ${overview.arch}`],
    ["当前目录", overview.currentDirectory],
    ["Pip", overview.pipVersion],
    ["主机", overview.hostname]
  ];

  if (overview.condaPath) {
    stats.push(["Conda 路径", overview.condaPath]);
  }

  elements.overviewStats.innerHTML = stats
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <span class="eyebrow">${label}</span>
          <strong>${value}</strong>
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
          <strong>Python ${entry.version}</strong>
          <span class="list-meta">${entry.path}</span>
        </article>
      `
    )
    .join("")
    : `<article class="list-item"><strong>${state.pythonVersionsLoaded ? "未检测到 Python 版本" : "正在后台检测 Python 版本..."}</strong></article>`;

  elements.condaEnvCount.textContent = String(overview.condaEnvironments.length);
  elements.condaOverviewList.innerHTML = overview.condaEnvironments.length
    ? overview.condaEnvironments
        .map(
          (env) => `
            <article class="list-item">
              <strong>${env.name}</strong>
              <span class="list-meta">Python ${env.pythonVersion}</span>
              <span class="list-meta">${env.path}</span>
            </article>
          `
        )
        .join("")
    : hasConda
      ? `<article class="list-item"><strong>Conda 已连接</strong><span class="list-meta">当前未读取到环境列表，可能是读取失败或尚未创建额外环境。</span></article>`
      : `<article class="list-item"><strong>未检测到 Conda</strong><span class="list-meta">可先检查 conda 安装路径。</span></article>`;
}

function renderCondaList() {
  elements.condaInventoryMeta.textContent = `${state.conda.length} 个环境`;
  elements.condaSourceSelect.innerHTML = state.conda
    .map((env) => `<option value="${env.name}">${env.name} · Python ${env.pythonVersion}</option>`)
    .join("");

  elements.condaList.innerHTML = state.conda.length
    ? state.conda
        .map(
          (env) => `
            <article class="list-item">
              <strong>${env.name}</strong>
              <span class="list-meta">Python ${env.pythonVersion}</span>
              <span class="list-meta">${env.path}</span>
              <span class="list-meta">${env.base ? "base 环境不可删除" : ""}</span>
              <div class="list-actions">
                ${
                  env.base
                    ? ""
                    : `<button class="ghost-button" data-delete-conda="${env.name}">删除</button>`
                }
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>${state.overview?.condaPath ? "Conda 已连接" : "没有检测到 Conda"}</strong><span class="list-meta">${state.overview?.condaPath ? "当前未读取到环境列表。你仍然可以尝试创建新环境。" : "请先确认 conda 安装路径或系统环境变量。"}</span></article>`;

  updateCondaSummary();
}

function renderVenvs() {
  elements.venvInventoryMeta.textContent = `${state.venvs.length} 个环境`;
  elements.venvList.innerHTML = state.venvs.length
    ? state.venvs
        .map(
          (env) => `
            <article class="list-item">
              <strong>${env.name}</strong>
              <span class="list-meta">Python ${env.pythonVersion}</span>
              <span class="list-meta">${env.path}</span>
              <div class="list-actions">
                <button class="ghost-button" data-delete-venv="${env.path}">删除</button>
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
    targets.push({ label: `conda: ${env.name}`, value: JSON.stringify({ type: "conda", name: env.name }) });
  });
  state.venvs.forEach((env) => {
    targets.push({ label: `venv: ${env.name}`, value: JSON.stringify({ type: "venv", name: env.name, path: env.path }) });
  });
  elements.packageTargetSelect.innerHTML = targets
    .map((target) => `<option value='${target.value}'>${target.label}</option>`)
    .join("");
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
    lines.push(`Python版本: ${data.get("pythonVersion")}`);
    lines.push(`额外安装包: ${packages.length ? packages.join(", ") : "无"}`);
    lines.push("预估动作: 执行 conda create，并追加额外包参数。");
  } else {
    const clonePython = form.elements.clonePython.checked;
    const clonePackages = form.elements.clonePackages.checked;
    lines.push("模式: 基于已有环境创建");
    lines.push(`源环境: ${data.get("sourceName") || "<未选择>"}`);
    lines.push(
      `克隆内容: ${
        [clonePython ? "Python版本" : "", clonePackages ? "已安装库" : ""].filter(Boolean).join(", ") || "未选择"
      }`
    );
    if (clonePython && clonePackages) {
      lines.push("预估动作: 使用 conda clone 完整复制。");
    } else if (clonePython) {
      lines.push("预估动作: 读取源环境 Python 版本，创建空环境。");
    } else if (clonePackages) {
      lines.push(`目标 Python 版本: ${data.get("targetPythonVersion")}`);
      lines.push(`导出策略: ${form.elements.explicitPackagesOnly.checked ? "仅显式安装包" : "完整环境依赖"}`);
      lines.push("预估动作: 导出环境 YAML，重写目标名称和 Python 版本后创建。");
    } else {
      lines.push("预估动作: 请至少选择一项克隆内容。");
    }
  }

  elements.condaSummary.textContent = lines.join("\n");
}

async function loadOverview() {
  setBusy("正在加载系统信息...");
  state.overview = await request("/api/overview");
  state.conda = state.overview.condaEnvironments;
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
}

async function deleteConda(name) {
  const confirmed = await askConfirm({
    title: "删除 Conda 环境",
    message: `确定要删除环境 “${name}” 吗？此操作不可撤销。`,
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
      message: `Conda 环境 “${name}” 已处理完成。`,
      details: result.message,
      closable: true
    });
  } catch (error) {
    setReady(error.message);
    updateOperationModal({
      eyebrow: "Failed",
      title: "删除失败",
      message: `Conda 环境 “${name}” 未能删除。`,
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
}

function getSelectedTarget() {
  return JSON.parse(elements.packageTargetSelect.value);
}

async function runPackageAction(action, payload = {}) {
  setBusy(`正在执行包操作: ${action}`);
  const data = await request(`/api/packages/${action}`, {
    method: "POST",
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

  document.querySelector("#refreshCondaButton").addEventListener("click", async () => {
    try {
      await loadCondaEnvironments();
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

  toggleMode();
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

  document.querySelector("#refreshTargetsButton").addEventListener("click", async () => {
    try {
      await Promise.all([loadCondaEnvironments({ silent: true }), loadVenvs(), loadOverview()]);
    } catch (error) {
      setReady(error.message);
      alert(error.message);
    }
  });

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
  document.querySelector("#upgradePipButton").addEventListener("click", () => runPackageAction("upgrade-pip"));
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
    loadPythonVersions();
  } catch (error) {
    setReady(error.message);
    alert(error.message);
  }
}

bootstrap();
