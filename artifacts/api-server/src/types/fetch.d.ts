// Type augmentation: undici-types Response compatibility with TypeScript 5.9.3 + @types/node@25
// auth.ts imports from express which causes Response type conflict — this augments the global Response
declare global {
  interface Response {
    json(): Promise<unknown>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    bytes(): Promise<Uint8Array>;
    formData(): Promise<FormData>;
  }
}

export {};
