import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_TURNS,
  buildMessages,
  buildSystemPrompt,
  cleanUserText,
  describeScreen,
} from "../convex/lib/chatPrompt";
import { promptData } from "./helpers";

describe("buildSystemPrompt", () => {
  const data = promptData();
  const prompt = buildSystemPrompt(data);

  it("lists every part id and every step", () => {
    for (const s of data.structures) expect(prompt).toContain(`${s.id}:`);
    for (const s of data.steps) expect(prompt).toContain(`${s.index + 1}. ${s.title}`);
  });

  it("ends with the JSON format instruction", () => {
    const tail = prompt.slice(-700);
    expect(tail).toContain("OUTPUT FORMAT");
    expect(tail).toContain('"answer"');
    expect(tail).toContain('"highlight"');
    expect(tail).toContain("nothing else");
  });

  it("tells the model the number of steps", () => {
    expect(prompt).toContain(`from 1 to ${data.steps.length}`);
  });

  it("stays short enough for free-tier token limits", () => {
    // Roughly 4 characters per token; keep the prompt well under 2,500 tokens
    expect(prompt.length).toBeLessThan(10_000);
  });
});

describe("describeScreen", () => {
  it("names the current step and the selected part", () => {
    const text = describeScreen(promptData({ currentStepIndex: 1, selectedStructureId: "aorta" }));
    expect(text).toContain("Step 2 of 4");
    expect(text).toContain("Delivering the new valve");
    expect(text).toContain("Aorta (aorta)");
  });

  it("says none when no part is selected", () => {
    expect(describeScreen(promptData())).toContain("Selected part: none");
  });
});

describe("buildMessages", () => {
  it("puts the system prompt first, the question last, and keeps the order", () => {
    const messages = buildMessages(promptData(), [], "What is this?");
    expect(messages[0]?.role).toBe("system");
    const last = messages[messages.length - 1]!;
    expect(last.role).toBe("user");
    expect(last.content).toContain("Question: What is this?");
    expect(last.content).toContain("[Screen]");
  });

  it("includes two worked examples whose answers are valid JSON", () => {
    const messages = buildMessages(promptData(), [], "hi");
    const examples = messages.filter((m) => m.role === "assistant");
    expect(examples).toHaveLength(2);
    for (const example of examples) expect(() => JSON.parse(example.content)).not.toThrow();
  });

  it("sends only the most recent history", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn ${i}`,
    }));
    const messages = buildMessages(promptData(), history, "now");
    const text = messages.map((m) => m.content).join("\n");
    expect(text).toContain(`turn ${history.length - 1}`);
    expect(text).not.toContain("turn 0");
    expect(messages.filter((m) => m.content.startsWith("turn ")).length).toBe(MAX_HISTORY_TURNS);
  });
});

describe("cleanUserText", () => {
  it("removes control characters", () => {
    const cleaned = cleanUserText("hello\u0000\u0007 world");
    // eslint-disable-next-line no-control-regex
    expect(cleaned).not.toMatch(/[\u0000-\u0008]/);
    expect(cleaned.replace(/\s+/g, " ")).toBe("hello world");
  });
});
