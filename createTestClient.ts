import { createHeaders, PORTKEY_GATEWAY_URL } from 'portkey-ai';
import { Fragola, type ClientOptions } from "@fragola-ai/agentic-sdk-core";
export const createTestClient = (opts?: ClientOptions) => {
  const defaultOpts: ClientOptions = {
    baseURL: PORTKEY_GATEWAY_URL,
    apiKey: "xxx",
    defaultHeaders: createHeaders({
      virtualKey: "google-966377",
      apiKey: process.env["TEST_API_KEY"],
      Authorization: `Bearer ${process.env["TEST_GCLOUD_AUTH_TOKEN"]}`
    }),
    model: process.env["TEST_MODEL_MEDIUM"]!
  }
  const _opts = opts ? { ...opts, ...defaultOpts } : defaultOpts;
  return new Fragola(_opts);
}