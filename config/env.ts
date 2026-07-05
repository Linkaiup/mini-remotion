import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");

let loaded = false;

/** 从项目根目录 `.env` 加载配置(类似 Python dotenv)。已存在的环境变量不会被覆盖。 */
export const loadEnv = (): void => {
  if (loaded) return;
  loaded = true;

  if (!existsSync(ENV_PATH)) return;

  const result = config({ path: ENV_PATH });
  if (result.error) {
    console.warn(`[env] 无法读取 ${ENV_PATH}: ${result.error.message}`);
  }
};
