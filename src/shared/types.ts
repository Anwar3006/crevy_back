export enum EEnvironment {
  dev = "development",
  prod = "production",
}

export type THealthStatus = {
  environment: EEnvironment;
  appVersion: string;
  timestamp: string;
};

export type TResponsePayload<TData> = {
  success: boolean;
  message: string;
  data: TData;
};
