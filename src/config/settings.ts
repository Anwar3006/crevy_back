import process from "node:process";
import { EnvSchema } from "@config/schemas/envSchema";
import type { EEnvironment } from "@shared/types";

class Settings {
	NODE_ENV: EEnvironment;
	APP_PORT: number;
	DATABASE_URL: string;

	constructor() {
		const { port, nodeEnv, databaseUrl } = this.parseEnv();
		this.APP_PORT = port;
		this.NODE_ENV = nodeEnv;
		this.DATABASE_URL = databaseUrl;
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
		};
	}
}

const settings = new Settings();
export default settings;
