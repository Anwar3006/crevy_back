import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dayjs from "dayjs";
import logger from "pino";

import { createStream } from "rotating-file-stream";

const logDirectory = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDirectory)) {
	console.log("logs dir is missing");
	fs.mkdirSync(logDirectory, { recursive: true });
	console.log("directory id created", logDirectory);
}

const errorLogStream = createStream("error.log", {
	interval: "1d",
	path: logDirectory,
});

const pinoLogger = logger({
	transport: {
		target: "pino-pretty",
	},
	base: {
		pid: false,
	},
	timestamp: () => `,"time":"${dayjs().format()}"`,
});

export { pinoLogger, errorLogStream };
