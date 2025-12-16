import { prepareDB } from "@config/db";
import errorLogStream from "@config/logger";
import settings from "@config/settings";
import v1Router from "@v1/index";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import multer from "multer";

const app = express();
const upload = multer();
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());
app.use(cookieParser());
app.use(upload.none());
app.use(
  morgan("common", {
    stream: errorLogStream,
    skip: (__, res) => res.statusCode < 400,
  }),
);
app.use("/api/v1", v1Router);
app.listen(3000, () =>
  console.log(`Server running on port ${settings.APP_PORT}`),
);
prepareDB();
