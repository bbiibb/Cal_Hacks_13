import { describe, expect, it } from "vitest";
import { buildMessages } from "../convex/lib/chatPrompt";
import {
  MAX_HISTORY_MESSAGE_CHARS,
  MAX_SUMMARY_QUESTIONS,
  MAX_SUMMARY_TOPICS,
  SUMMARY_MAX_CHARS,
  SUMMARY_QUESTION_CHARS,
  capHistoryMessage,
  foldMessages,
  renderSummary,
  shorten,
} from "../convex/lib/chatSummary";
import { buildLocalMessages } from "../convex/lib/localPrompt";
import { keywordDocs, mergeDocs, pinnedDocs } from "../convex/lib/rag";
import { promptData } from "./helpers";

const user = (content: string) => ({ role: "user" as const, content });
const assistant = (content: string, ...titles: string[]) => ({
  role: "assistant" as const,
  content,
  sources: titles.map((title) => ({ title })),
});

describe("shorten", () => {
  it("keeps short text, collapses spaces, and cuts long text at a word with an ellipsis", () => {
    expect(shorten("  a   short one ", 50)).toBe("a short one");
    const cut = shorten("word ".repeat(40), SUMMARY_QUESTION_CHARS);
    expect(cut.length).toBeLessThanOrEqual(SUMMARY_QUESTION_CHARS);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/wor…$/);
  });
});

describe("foldMessages", () => {
  it("keeps what the patient asked, shortened, and the topics that answers cited", () => {
    const summary = foldMessages(undefined, [
      user("Will I need a pacemaker afterwards?"),
      assistant("About 8% to 20%...", "Risk: heart rhythm problems and pacemaker (TAVR patient information guide)"),
    ]);
    expect(summary.questions).toEqual(["Will I need a pacemaker afterwards?"]);
    expect(summary.topics).toEqual(["Risk: heart rhythm problems and pacemaker"]);
  });

  it("never keeps the assistant's own sentences", () => {
    const summary = foldMessages(undefined, [user("Hi"), assistant("The secret answer sentence.", "Guidewire (TAVR patient information guide)")]);
    expect(JSON.stringify(summary)).not.toContain("secret answer sentence");
  });

  it("adds to an existing summary without repeating a question or a topic", () => {
    const first = foldMessages(undefined, [user("What is TAVR?"), assistant("x", "What TAVR is (g)")]);
    const second = foldMessages(first, [user("what is tavr?"), assistant("y", "What TAVR is (g)"), user("Is it painful?")]);
    expect(second.questions).toEqual(["what is tavr?", "Is it painful?"]);
    expect(second.topics).toEqual(["What TAVR is"]);
  });

  it("keeps only the newest questions and topics when there are too many", () => {
    const many = Array.from({ length: 30 }, (_, i) => [user(`Question number ${i}`), assistant("a", `Topic ${i} (g)`)]).flat();
    const summary = foldMessages(undefined, many);
    expect(summary.questions).toHaveLength(MAX_SUMMARY_QUESTIONS);
    expect(summary.topics).toHaveLength(MAX_SUMMARY_TOPICS);
    expect(summary.questions.at(-1)).toBe("Question number 29");
    expect(summary.topics[0]).toBe("Topic 24");
  });

  it("ignores empty messages", () => {
    expect(foldMessages(undefined, [user("   ")])).toEqual({ questions: [], topics: [] });
  });
});

describe("renderSummary", () => {
  it("is empty when there is nothing to say", () => {
    expect(renderSummary(undefined)).toBe("");
    expect(renderSummary({ questions: [], topics: [] })).toBe("");
  });

  it("reads as one short paragraph", () => {
    expect(renderSummary({ questions: ["What is TAVR?", "Is it painful?"], topics: ["What TAVR is"] })).toBe(
      'The patient earlier asked: "What is TAVR?"; "Is it painful?". Already explained: What TAVR is.',
    );
  });

  it("never exceeds the size limit, and drops the oldest questions first", () => {
    const questions = Array.from({ length: MAX_SUMMARY_QUESTIONS }, (_, i) => `${i} ${"long question ".repeat(7)}`.trim());
    const text = renderSummary({ questions, topics: ["Topic A"] });
    expect(text.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS);
    expect(text).toContain(`${MAX_SUMMARY_QUESTIONS - 1} long question`);
    expect(text).not.toContain('"0 long question');
    expect(text).toContain("Already explained: Topic A.");
  });
});

describe("capHistoryMessage", () => {
  it("cuts only unusually long earlier messages", () => {
    expect(capHistoryMessage("short")).toBe("short");
    expect(capHistoryMessage("x".repeat(2000)).length).toBe(MAX_HISTORY_MESSAGE_CHARS);
  });
});

describe("the summary in the prompts", () => {
  const summary = renderSummary({ questions: ["Will I need a pacemaker afterwards?"], topics: ["Risk: heart rhythm problems and pacemaker"] });
  const data = promptData({ currentStepIndex: 1, conversationSummary: summary });

  it("is added to the cloud prompt", () => {
    const system = buildMessages(data, [], "And is it painful?")[0]!.content;
    expect(system).toContain("EARLIER IN THIS CONVERSATION");
    expect(system).toContain("pacemaker afterwards");
  });

  it("is added to the local prompt, before the rules", () => {
    const docs = mergeDocs(pinnedDocs(data), keywordDocs(data, "painful"));
    const system = buildLocalMessages(data, [], "And is it painful?", docs)[0]!.content;
    expect(system.indexOf("EARLIER IN THIS CONVERSATION")).toBeGreaterThan(system.indexOf("CONTEXT:"));
    expect(system.indexOf("EARLIER IN THIS CONVERSATION")).toBeLessThan(system.indexOf("RULES:"));
  });

  it("is left out when the conversation is short", () => {
    const plain = promptData({ currentStepIndex: 1 });
    expect(buildMessages(plain, [], "Hi")[0]!.content).not.toContain("EARLIER IN THIS CONVERSATION");
    expect(buildLocalMessages(plain, [], "Hi", pinnedDocs(plain))[0]!.content).not.toContain("EARLIER IN THIS CONVERSATION");
  });

  it("still fits the 2048-token window of the local model with a full summary and a full history", () => {
    const full = renderSummary({
      questions: Array.from({ length: MAX_SUMMARY_QUESTIONS }, (_, i) => `${i} ${"a fairly long earlier question ".repeat(3)}`),
      topics: Array.from({ length: MAX_SUMMARY_TOPICS }, (_, i) => `Risk: some long topic title number ${i}`),
    });
    const big = promptData({ currentStepIndex: 1, selectedStructureId: "aortic_valve", conversationSummary: full });
    const docs = mergeDocs(pinnedDocs(big), keywordDocs(big, "What are the risks of TAVR and the complications?", 6));
    const history = Array.from({ length: 6 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", content: "y".repeat(2000) }));
    const chars = buildLocalMessages(big, history, "A question of normal length about the procedure?", docs).reduce((n, m) => n + m.content.length, 0);
    // 2048 tokens minus the 300 allowed for the answer is 1748; stay well below it (about 4 characters per token)
    expect(chars / 4).toBeLessThan(1600);
  });
});
