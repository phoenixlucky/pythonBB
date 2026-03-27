import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDefaultCondaExportDirectory,
  buildDefaultCondaExportFilePath,
  createCondaEnvironment,
  createVirtualEnvironment,
  deleteCondaEnvironment,
  deleteVirtualEnvironment,
  discoverPythonVersions,
  exportAllCondaEnvironmentsToDirectory,
  exportCondaEnvironmentToFile,
  importCondaEnvironmentFromFile,
  listCondaEnvironments,
  listVirtualEnvironments
} from "./services/environment-service.js";
import {
  getPackageTask,
  getLatestPackageVersion,
  installFromRequirements,
  installPackage,
  listPackages,
  showPackageInfo,
  startInstallPackageTask,
  uninstallPackage,
  upgradeAllPackages,
  upgradePip
} from "./services/package-service.js";
import { getSystemOverview } from "./services/system-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const DEFAULT_PORT = Number(process.env.PORT || 3210);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const typeMap = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    };
    response.writeHead(200, {
      "Content-Type": typeMap[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

function parseTarget(target) {
  if (!target?.type) {
    throw new Error("缺少环境目标信息");
  }
  return target;
}

async function handleApi(request, response, pathname, searchParams) {
  const preferredCondaRoot = searchParams.get("condaRoot") || "";

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && pathname === "/api/overview") {
      sendJson(response, 200, await getSystemOverview(preferredCondaRoot));
      return;
    }

    if (request.method === "GET" && pathname === "/api/python/versions") {
      sendJson(response, 200, await discoverPythonVersions());
      return;
    }

    if (request.method === "GET" && pathname === "/api/conda/environments") {
      sendJson(response, 200, await listCondaEnvironments(preferredCondaRoot));
      return;
    }

    if (request.method === "GET" && pathname === "/api/conda/environments/export/default-path") {
      sendJson(response, 200, {
        filePath: buildDefaultCondaExportFilePath(searchParams.get("sourceName") || "")
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/conda/environments/export/default-directory") {
      sendJson(response, 200, {
        directoryPath: buildDefaultCondaExportDirectory()
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/conda/environments") {
      sendJson(response, 200, await createCondaEnvironment(await readBody(request), preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/conda/environments/export") {
      sendJson(response, 200, await exportCondaEnvironmentToFile(await readBody(request), preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/conda/environments/export-all") {
      sendJson(response, 200, await exportAllCondaEnvironmentsToDirectory(await readBody(request), preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/conda/environments/import") {
      sendJson(response, 200, await importCondaEnvironmentFromFile(await readBody(request), preferredCondaRoot));
      return;
    }

    if (request.method === "DELETE" && pathname.startsWith("/api/conda/environments/")) {
      const name = decodeURIComponent(pathname.split("/").pop());
      sendJson(response, 200, await deleteCondaEnvironment(name, preferredCondaRoot));
      return;
    }

    if (request.method === "GET" && pathname === "/api/venvs") {
      sendJson(response, 200, await listVirtualEnvironments(searchParams.get("lastDirectory") || undefined));
      return;
    }

    if (request.method === "POST" && pathname === "/api/venvs") {
      sendJson(response, 200, await createVirtualEnvironment(await readBody(request)));
      return;
    }

    if (request.method === "DELETE" && pathname === "/api/venvs") {
      sendJson(response, 200, await deleteVirtualEnvironment(searchParams.get("path")));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/list") {
      const body = await readBody(request);
      sendJson(response, 200, await listPackages(parseTarget(body.target), preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/install") {
      const body = await readBody(request);
      sendJson(
        response,
        200,
        await installPackage(parseTarget(body.target), body.packageName, Boolean(body.upgrade), preferredCondaRoot)
      );
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/install-task") {
      const body = await readBody(request);
      sendJson(
        response,
        200,
        await startInstallPackageTask(parseTarget(body.target), body.packageName, Boolean(body.upgrade), preferredCondaRoot)
      );
      return;
    }

    if (request.method === "GET" && pathname.startsWith("/api/packages/tasks/")) {
      const taskId = decodeURIComponent(pathname.split("/").pop());
      sendJson(response, 200, getPackageTask(taskId));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/uninstall") {
      const body = await readBody(request);
      sendJson(response, 200, await uninstallPackage(parseTarget(body.target), body.packageName, preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/show") {
      const body = await readBody(request);
      sendJson(response, 200, await showPackageInfo(parseTarget(body.target), body.packageName, preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/latest-version") {
      const body = await readBody(request);
      sendJson(response, 200, await getLatestPackageVersion(body.packageName));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/upgrade-pip") {
      const body = await readBody(request);
      sendJson(response, 200, await upgradePip(parseTarget(body.target), preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/upgrade-all") {
      const body = await readBody(request);
      sendJson(response, 200, await upgradeAllPackages(parseTarget(body.target), preferredCondaRoot));
      return;
    }

    if (request.method === "POST" && pathname === "/api/packages/install-requirements") {
      const body = await readBody(request);
      sendJson(
        response,
        200,
        await installFromRequirements(parseTarget(body.target), body.requirementsPath, preferredCondaRoot)
      );
      return;
    }

    sendJson(response, 404, { error: "API not found" });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, requestUrl.pathname, requestUrl.searchParams);
      return;
    }

    await serveStatic(response, requestUrl.pathname);
  });
}

export function startServer({ port = DEFAULT_PORT, host = "127.0.0.1" } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", (error) => {
      reject(error);
    });

    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolve({
        server,
        host,
        port: actualPort,
        url: `http://${host}:${actualPort}`
      });
    });
  });
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  startServer()
    .then(({ url }) => {
      console.log(`PythonBB Web 已启动: ${url}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
