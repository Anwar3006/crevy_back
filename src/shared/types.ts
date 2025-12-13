export enum EEnvironment {
    dev = "development",
    prod = "production",
};

export type TResponsePayload = {
    success: boolean;
    message: string;
    data: object;
};
