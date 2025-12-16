import type { TUser } from "@v1/auth/types";
import express, { type Request, type Response } from "express";
import { v7 as uuid7 } from "uuid";
import type { TResponsePayload } from "@/shared/types";

const authRouter = express.Router();
authRouter.get("/", (_: Request, res: Response<TResponsePayload>) => {
  const user: TUser = {
    id: uuid7(),
    userName: "jakesavage",
    firstName: "Jake",
    lastName: "Savage",
    createdAt: Date.now(),
  };
  return res.json({ success: true, message: "User found", data: user });
});
export { authRouter };
