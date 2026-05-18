import process from "node:process";
import { EnvSchema } from "./schemas/envSchema";
import type { EEnvironment } from "../shared/types";

class Settings {
  NODE_ENV: EEnvironment;
  APP_PORT: number;
  DATABASE_URL: string;
  SALT_WORK_FACTOR: number;
  FRONTEND_URL: string;
  API_VERSION: string;
  REDIS_URL: string | undefined;

  constructor() {
    const { port, nodeEnv, databaseUrl, saltWorkFactor, frontendUrl,apiVersion, redisUrl } =
      this.parseEnv();
    this.APP_PORT = port;
    this.NODE_ENV = nodeEnv;
    this.DATABASE_URL = databaseUrl;
    this.SALT_WORK_FACTOR = saltWorkFactor;
    this.FRONTEND_URL = frontendUrl;
    this.API_VERSION = apiVersion;
    this.REDIS_URL = redisUrl;
  }

  parseEnv() {
    const { success, error } = EnvSchema.safeParse(process.env);
    if (!success) {
      const { message } = error;
      throw new Error(message);
    }
    return {
      port: Number(process.env.APP_PORT) as number,
      nodeEnv: process.env.NODE_ENV as EEnvironment,
      databaseUrl: process.env.DATABASE_URL as string,
      saltWorkFactor: Number(process.env.SALT_WORK_FACTOR) as number,
      frontendUrl: process.env.FRONTEND_URL as string,
      apiVersion: process.env.API_VERSION as string,
      redisUrl: process.env.REDIS_URL as string | undefined,
    };
  }
}

const settings = new Settings();
export default settings;
