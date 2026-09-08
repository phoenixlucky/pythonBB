export interface RuntimeInfo {
  python: string;
  conda: string;
  platform: string;
}

export interface CondaEnvironment {
  name: string;
  prefix: string;
  python: string;
  packageCount: number;
  active: boolean;
}

export interface Overview {
  runtime: RuntimeInfo;
  environments: CondaEnvironment[];
  checkedAt: string;
}

export interface AppSettings {
  condaPath?: string;
  tagline: string;
  compactMode: boolean;
  wallpaper?: string;
  primary?: string;
  secondary?: string;
  ink?: string;
}

export interface VirtualEnvironment {
  name: string;
  path: string;
  manager: string;
  pythonVersion: string;
}

export interface PackageInfo {
  name: string;
  version: string;
}

export interface EnvironmentTarget {
  targetType: string;
  name?: string;
  path?: string;
  manager?: string;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  command: string;
  output: string;
}

export interface ActiveProcess {
  pid: number;
  command: string;
  startedAt: number;
  taskId?: string;
}

export interface TaskSnapshot {
  taskId: string;
  taskType: string;
  status: "running" | "completed" | "failed" | "cancelled";
  message: string;
  progress: number;
  output: string;
  command: string;
  startedAt: number;
  finishedAt?: number;
}
