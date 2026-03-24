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
      let settled = false;
      const commandLine = [command, ...args].map(quoteShellArg).join(" ");
      const child = exec(
        commandLine,
        {
          cwd: options.cwd,
          windowsHide: true,
          env: { ...process.env, ...(options.env || {}) }
        },
        (error, stdout, stderr) => {
          if (settled) {
            return;
          }
          settled = true;
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

      if (options.timeoutMs) {
        setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          child.kill();
          resolve({
            ok: false,
            code: 124,
            stdout: "",
            stderr: `命令执行超时（>${options.timeoutMs}ms）`
          });
        }, options.timeoutMs);
      }
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
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(payload);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      finish({
        ok: code === 0,
        code,
        stdout,
        stderr
      });
    });

    if (options.timeoutMs) {
      setTimeout(() => {
        if (settled) {
          return;
        }
        child.kill();
        finish({
          ok: false,
          code: 124,
          stdout,
          stderr: stderr || `命令执行超时（>${options.timeoutMs}ms）`
        });
      }, options.timeoutMs);
    }
  });
}

export function runStreamingCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
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
    let settled = false;
    let timeoutId = null;

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(payload);
    };

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      options.onStdout?.(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      options.onStderr?.(text);
    });

    child.on("error", (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });

    child.on("close", (code) => {
      finish({
        ok: code === 0,
        code,
        stdout,
        stderr
      });
    });

    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }
        child.kill();
        finish({
          ok: false,
          code: 124,
          stdout,
          stderr: stderr || `命令执行超时（>${options.timeoutMs}ms）`
        });
      }, options.timeoutMs);
    }
  });
}
