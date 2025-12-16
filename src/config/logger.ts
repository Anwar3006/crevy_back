import fs from "node:fs";
import path from "node:path";
import process from "node:process";
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

export default errorLogStream;
