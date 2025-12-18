import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dayjs from "dayjs";
import logger from "pino";

import { createStream } from "rotating-file-stream";

const pinoLogger = logger({
  transport: {
    target: "pino-pretty",
  },
  base: {
    pid: false,
  },
  timestamp: () => `,"time":"${dayjs().format()}"`,
});

const logDirectory = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDirectory)) {
  pinoLogger.warn(`Logs dir is missing. Creating...`);
  fs.mkdirSync(logDirectory, { recursive: true });
  pinoLogger.info(`Directory id created: ${logDirectory}`);
}

const errorLogStream = createStream("error.log", {
  interval: "1d",
  path: logDirectory,
});

export { pinoLogger, errorLogStream };
