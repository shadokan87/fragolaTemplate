import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

const agent = fragola.agent({
    name: "assistant",
    instructions: "you are a helpful assistant",
    description: "assistant",
    modelSettings: {
        stream: true
    }
});

import { startSpinner, stopSpinner, renderMessages, renderStatus, promptUser, beginStreaming, renderStreamingChunk } from "./ui";

// Refresh UI after every state update
let _wasGenerating = false;
agent.onAfterStateUpdate((context) => {
    const { status, messages } = context.state;
    if (status === "generating") {
        if (!_wasGenerating) {
            // First chunk — snapshot the settled history
            beginStreaming(messages);
        }
        _wasGenerating = true;
        renderStreamingChunk(messages, status);
    } else {
        _wasGenerating = false;
        stopSpinner();
        console.clear();
        renderStatus(status);
        renderMessages(messages);
    }
});

// Main REPL loop
console.clear();
console.log("Fragola CLI — type your message, or Ctrl+C to exit\n");

while (true) {
    const input = await promptUser("You: ");
    if (!input) continue;

    await agent.userMessage({ content: input });
}