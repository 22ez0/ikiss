// Type augmentation: complete Fetch API Response interface
// Fixes TypeScript 5.9.3 + @types/node@25 where global Response is missing properties
// caused by express import conflicting with undici-types Response augmentation
declare global {
  interface Response {
    readonly ok: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly url: string;
    readonly redirected: boolean;
    readonly type: ResponseType;
    readonly body: ReadableStream<Uint8Array> | null;
    readonly bodyUsed: boolean;
    readonly headers: Headers;
    json(): Promise<unknown>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    bytes(): Promise<Uint8Array>;
    formData(): Promise<FormData>;
    clone(): Response;
  }
}

export {};
