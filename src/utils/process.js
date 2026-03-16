import { exec, spawn } from "node:child_process";

function quoteShellArg(arg) {
  const value = String(arg);
  if (value === "") {
    return '""';
  }
  if (!/[\s"]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    if (options.shell) {
      const commandLine = [command, ...args].map(quoteShellArg).join(" ");
      exec(
        commandLine,
        {
          cwd: options.cwd,
          windowsHide: true,
          env: { ...process.env, ...(options.env || {}) }
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              ok: false,
              code: error.code ?? 1,
              stdout: stdout ?? "",
              stderr: stderr || error.message
            });
            return;
          }

          resolve({
            ok: true,
            code: 0,
            stdout: stdout ?? "",
            stderr: stderr ?? ""
          });
        }
      );
      return;
    }

    let child;

    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...(options.env || {}) }
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr
      });
    });
  });
}
