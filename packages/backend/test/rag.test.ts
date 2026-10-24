import { describe, expect, it } from "vitest";
import { buildLocalMessages, buildLocalSchema, buildLocalSystemPrompt, MAX_LOCAL_HISTORY_TURNS } from "../convex/lib/localPrompt";
import { selectProvider, LlmError } from "../convex/lib/llm";
import { EMBEDDING_DIMENSIONS } from "../convex/lib/ragConfig";
import { allowedStructureIds, buildDocs, mergeDocs, pinnedDocs, MAX_CONTEXT_DOCS } from "../convex/lib/rag";
import { promptData } from "./helpers";

describe("buildDocs", () => {
  const data = promptData();
  const docs = buildDocs(data);

  it("makes one document per part and per step with stable ids", () => {
    expect(docs).toHaveLength(data.structures.length + data.steps.length + (data.knowledge?.length ?? 0));
    expect(docs.filter((d) => d.kind === "structure")).toHaveLength(data.structures.length);
    expect(docs.filter((d) => d.kind === "knowledge")).toHaveLength(data.knowledge?.length ?? 0);
    expect(docs.find((d) => d.docId === "knowledge:risk.stroke")?.sourceTitle).toContain("TAVR patient information guide");
    expect(docs.find((d) => d.docId === "structure:aortic_valve")?.text).toContain("Native aortic valve");
    expect(docs.find((d) => d.docId === "step:tavr:2")?.stepIndex).toBe(2);
    expect(new Set(docs.map((d) => d.docId)).size).toBe(docs.length);
  });
});

describe("pinned and merged context", () => {
  const data = promptData({ currentStepIndex: 1, selectedStructureId: "aorta" });

  it("always includes the step on screen and the selected part", () => {
    const pinned = pinnedDocs(data);
    expect(pinned.map((d) => d.docId)).toEqual(["step:tavr:1", "structure:aorta"]);
  });

  it("puts pinned documents first, removes duplicates, and respects the limit", () => {
    const pinned = pinnedDocs(data);
    const found = buildDocs(data).slice(0, 10);
    const merged = mergeDocs(pinned, found);
    expect(merged[0]?.docId).toBe("step:tavr:1");
    expect(new Set(merged.map((d) => d.docId)).size).toBe(merged.length);
    expect(merged.length).toBeLessThanOrEqual(MAX_CONTEXT_DOCS);
  });

  it("allows only parts that appear in the context", () => {
    const merged = mergeDocs(pinnedDocs(data), []);
    expect(allowedStructureIds(merged)).toEqual(["aorta"]);
  });
});

describe("local prompt", () => {
  const data = promptData({ currentStepIndex: 2 });
  const docs = mergeDocs(pinnedDocs(data), buildDocs(data).filter((d) => d.structureId?.startsWith("aortic")).slice(0, 3));
  const ids = allowedStructureIds(docs);

  it("lists the context and the allowed ids, and ends with the JSON format", () => {
    const prompt = buildLocalSystemPrompt(docs, ids);
    for (const d of docs) expect(prompt).toContain(d.title);
    expect(prompt).toContain(`ALLOWED IDS: ${ids.join(", ")}`);
    expect(prompt.slice(-250)).toContain('"answer"');
    expect(prompt.slice(-250)).toContain("ONLY");
  });

  it("is short enough for a 3B model", () => {
    const messages = buildLocalMessages(data, [], "What is this?", docs);
    const chars = messages.reduce((n, m) => n + m.content.length, 0);
    expect(chars / 4).toBeLessThan(900); // roughly 900 tokens
  });

  it("includes a valid JSON example and only the latest history", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn ${i}`,
    }));
    const messages = buildLocalMessages(data, history, "now", docs);
    const example = messages.find((m) => m.role === "assistant" && m.content.startsWith("{"));
    expect(() => JSON.parse(example!.content)).not.toThrow();
    expect(messages.filter((m) => m.content.startsWith("turn ")).length).toBe(MAX_LOCAL_HISTORY_TURNS);
    expect(messages[messages.length - 1]!.content).toContain("Question: now");
  });
});

describe("buildLocalSchema", () => {
  it("restricts highlight to the allowed ids, at most three", () => {
    const schema = buildLocalSchema(["a", "b"]) as { properties: { highlight: { items: { enum: string[] }; maxItems: number } }; required: string[] };
    expect(schema.properties.highlight.items.enum).toEqual(["a", "b"]);
    expect(schema.properties.highlight.maxItems).toBe(3);
    expect(schema.required).toEqual(["answer", "highlight", "urgent", "safety", "doctor_question"]);
  });

  it("allows no highlight at all when there are no allowed ids", () => {
    const schema = buildLocalSchema([]) as { properties: { highlight: { maxItems: number } } };
    expect(schema.properties.highlight.maxItems).toBe(0);
  });
});

describe("selectProvider", () => {
  it("defaults to groq and accepts local", () => {
    expect(selectProvider({})).toBe("groq");
    expect(selectProvider({ LLM_PROVIDER: " Groq " })).toBe("groq");
    expect(selectProvider({ LLM_PROVIDER: "LOCAL" })).toBe("local");
  });

  it("rejects an unknown provider", () => {
    expect(() => selectProvider({ LLM_PROVIDER: "openai" })).toThrow(LlmError);
  });
});

describe("embedding size", () => {
  it("matches nomic-embed-text", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });
});
