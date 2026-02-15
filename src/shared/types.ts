import { UserDB } from "@/v1/auth/schema/authSchema";

export enum EEnvironment {
  dev = "development",
  prod = "production",
}

export type THealthStatus = {
  environment: EEnvironment;
  appVersion: string;
  timestamp: string;
};

export type TSignUpSuccess = Pick<
  UserDB,
  "id" | "email" | "firstName" | "lastName" | "userType" | "profileCompleted"
>;

export type TSignInSuccess = {
  token: string;
  redirect: boolean;
  url?: string;
  user: UserDB;
};

export type TResponsePayload<TData> = {
  success: boolean;
  message: string;
  data: TData;
};
