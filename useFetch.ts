import { tool } from "@fragola-ai/agentic-sdk-core";
import { Hook, type FragolaHook } from "@fragola-ai/agentic-sdk-core/hook";
import { z } from "zod";

export type FetchCallbackParams = {
  /** The reason the AI is making this call */
  requestCTX: string;
  url: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
};

export type FetchCallbackResult = {
  /** Override or extend the request body */
  body?: Record<string, unknown>;
  /** Override or extend the headers */
  headers?: Record<string, string>;
  /** Return false to cancel the request; return a string to send it as the tool result instead */
  abort?: false | string;
};

export type UseFetchOptions = {
  /**
   * Called before every fetch so you can inspect the AI's intent,
   * inject auth headers, mutate the body, or abort the request.
   */
  onBeforeRequest?: (params: FetchCallbackParams) => FetchCallbackResult | Promise<FetchCallbackResult>;
};

const fetchParamsSchema = z.object({
  url: z.string().url().describe("The full URL to send the request to"),
  body: z
    .record(z.unknown())
    .optional()
    .describe("Optional JSON body for the request"),
  requestCTX: z
    .string()
    .describe("A human-readable explanation of why this API call is being made"),
});

export function useFetch(options: UseFetchOptions = {}): FragolaHook {
  return Hook((agent) => {
    agent.context.updateTools((prev) => [
      ...prev,
      tool({
        name: "fetch",
        description:
          "Make an HTTP request to a URL. Use requestCTX to explain the purpose of the call.",
        schema: fetchParamsSchema,
        handler: async ({ url, body, requestCTX }) => {
          let headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          let resolvedBody = body;

          if (options.onBeforeRequest) {
            const result = await options.onBeforeRequest({
              requestCTX,
              url,
              body,
              headers: { ...headers },
            });

            if (typeof result.abort === "string") {
              return result.abort;
            }
            if (result.abort === false) {
              return "Request was aborted.";
            }

            if (result.headers) {
              headers = { ...headers, ...result.headers };
            }
            if (result.body !== undefined) {
              resolvedBody = result.body;
            }
          }

          const method = resolvedBody !== undefined ? "POST" : "GET";

          try {
            const response = await fetch(url, {
              method,
              headers,
              body: resolvedBody !== undefined ? JSON.stringify(resolvedBody) : undefined,
            });

            const text = await response.text();
            let parsed: unknown;
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }

            return {
              status: response.status,
              ok: response.ok,
              body: parsed,
            };
          } catch (err: any) {
            return { error: err?.message ?? String(err) };
          }
        },
      }),
    ]);
  });
}
