import { type ChatCompletionMessageParam } from "@fragola-ai/agentic-sdk-core";
import chalk from "chalk";
import * as readline from "readline";

// ── Spinner (used while waiting before first streaming chunk) ─────────────────
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let spinnerFrame = 0;

export function startSpinner(label = "Generating") {
  if (spinnerTimer) return;
  process.stdout.write("\n");
  spinnerTimer = setInterval(() => {
    const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(chalk.cyan(`${frame} ${label}...`));
    spinnerFrame++;
  }, 80);
}

export function stopSpinner() {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  }
}

// ── Streaming render state ────────────────────────────────────────────────────
// Track the last rendered non-streaming messages so we only re-draw the
// streaming tail on each chunk rather than diffing the entire history.
let _streamingBaseRendered = false;
let _streamingBaseLength = 0;

/** Call once when streaming starts to snapshot the "settled" history. */
export function beginStreaming(messages: ChatCompletionMessageParam[]) {
  stopSpinner();
  _streamingBaseRendered = false;
  // The last message is the partial assistant chunk; everything before it is settled.
  _streamingBaseLength = messages.length - 1;
}

/**
 * Re-render during streaming: settled history is printed once, then the
 * partial last message overwrites the streaming area on every chunk.
 */
export function renderStreamingChunk(
  messages: ChatCompletionMessageParam[],
  status: "idle" | "generating" | "waiting",
) {
  process.stdout.write("\x1b[?25l"); // hide cursor during update
  console.clear();
  renderStatus(status);
  // Render settled messages
  const settled = messages.slice(0, _streamingBaseLength);
  for (const msg of settled) {
    if (msg.role === "system" || msg.role === "developer") continue;
    _renderMessage(msg, false);
  }
  // Render the partial (streaming) last message with a cursor indicator
  const partial = messages[messages.length - 1];
  if (partial) _renderMessage(partial, true);
  process.stdout.write("\x1b[?25h"); // restore cursor
}

// ── Message rendering ─────────────────────────────────────────────────────────
function _renderMessage(msg: ChatCompletionMessageParam, streaming = false) {
  switch (msg.role) {
    case "user": {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      console.log(chalk.green.bold("┌─ User"));
      console.log(chalk.green(`│ ${content.replace(/\n/g, "\n│ ")}`));
      console.log(chalk.green("└─────────────────────────────────────────────────"));
      break;
    }
    case "assistant": {
      const content = typeof msg.content === "string"
        ? msg.content
        : msg.content
        ? JSON.stringify(msg.content)
        : "";
      const toolCalls = (msg as any).tool_calls as any[] | undefined;
      const header = streaming ? "┌─ Assistant " + chalk.cyan("▍") : "┌─ Assistant";
      console.log(chalk.blue.bold(header));
      if (content) {
        console.log(chalk.blue(`│ ${content.replace(/\n/g, "\n│ ")}${streaming ? chalk.cyan("▍") : ""}`));
      }
      if (toolCalls?.length) {
        for (const tc of toolCalls) {
          const args = (() => {
            try { return JSON.stringify(JSON.parse(tc.function.arguments), null, 2); }
            catch { return tc.function.arguments; }
          })();
          console.log(chalk.yellow(`│ 🔧 Tool call: ${chalk.bold(tc.function.name)}`));
          console.log(chalk.yellow(`│    args: ${args.replace(/\n/g, "\n│           ")}`));
        }
      }
      console.log(chalk.blue("└─────────────────────────────────────────────────"));
      break;
    }
    case "tool": {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      console.log(chalk.magenta.bold("┌─ Tool result"));
      console.log(chalk.magenta(`│ ${content.replace(/\n/g, "\n│ ")}`));
      console.log(chalk.magenta("└─────────────────────────────────────────────────"));
      break;
    }
    default:
      break;
  }
}

export function renderMessages(messages: ChatCompletionMessageParam[]) {
  for (const msg of messages) {
    if (msg.role === "system" || msg.role === "developer") continue;
    _renderMessage(msg, false);
  }
}

// ── Status bar ────────────────────────────────────────────────────────────────
export function renderStatus(status: "idle" | "generating" | "waiting") {
  const map: Record<string, string> = {
    idle: chalk.gray("● idle"),
    generating: chalk.cyan("◎ generating"),
    waiting: chalk.yellow("◌ waiting"),
  };
  console.log(chalk.dim(`[status: ${map[status] ?? status}]`));
}

// ── Prompt ────────────────────────────────────────────────────────────────────
export async function promptUser(prompt = "You: "): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(chalk.green.bold(prompt), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
