import { describe, expect, it, vi } from "vitest";
import { runChat } from "../convex/lib/chatPipeline";
import { buildLocalMessages, buildLocalSchema } from "../convex/lib/localPrompt";
import { allowedStructureIds, buildDocs, mergeDocs, pinnedDocs } from "../convex/lib/rag";
import { fixtureLookup, promptData } from "./helpers";

// The local pipeline: pinned + retrieved context, a short prompt, and replies a 3B model would give
const data = promptData({ currentStepIndex: 2 });
const found = buildDocs(data).filter((d) => d.docId === "structure:aortic_valve" || d.docId === "structure:aortic_annulus");
const docs = mergeDocs(pinnedDocs(data), found);

function run(message: string, replies: string[]) {
  const callModel = vi.fn();
  for (const r of replies) callModel.mockResolvedValueOnce(r);
  return runChat({
    message,
    data,
    history: [],
    callModel,
    buildMessages: (d, h, m) => buildLocalMessages(d, h, m, docs),
    lookup: fixtureLookup(data),
  }).then((result) => ({ result, callModel }));
}

describe("runChat with the local prompt", () => {
  it("builds the short local prompt, not the cloud one", async () => {
    const { callModel } = await run("What is the annulus?", [JSON.stringify({ answer: "A ring of tissue.", highlight: [], urgent: false, safety: "", doctor_question: "" })]);
    const messages = callModel.mock.calls[0]![0] as { role: string; content: string }[];
    expect(messages[0]!.content).toContain("Answer using ONLY the CONTEXT");
    expect(messages[0]!.content).not.toContain("PARTS YOU CAN POINT AT");
  });

  it("turns a minimal 3B reply into a full response with a side panel from our content", async () => {
    const { result } = await run("What is the annulus?", [
      JSON.stringify({ answer: "It is the ring the valve sits in.", highlight: ["aortic_annulus"], urgent: false, safety: "", doctor_question: "" }),
    ]);
    const r = result.response;
    expect(r.message).toBe("It is the ring the valve sits in.");
    expect(r.scene_actions).toEqual([
      { type: "focus", structure_id: "aortic_annulus" },
      { type: "highlight", structure_ids: ["aortic_annulus"], enabled: true },
    ]);
    expect(r.side_panel?.title).toBe("Aortic annulus");
  });

  it("reads camera commands from the patient's words because the 3B model is not asked for them", async () => {
    const { result } = await run("Zoom in and rotate it left 60 degrees", [
      JSON.stringify({ answer: "Done.", highlight: [], urgent: false, safety: "", doctor_question: "" }),
    ]);
    expect(result.response.scene_actions).toEqual([
      { type: "zoom", direction: "in", amount: "medium" },
      { type: "rotate", direction: "left", degrees: 60 },
    ]);
  });

  it("copes with a 3B reply wrapped in text and with a retry", async () => {
    const good = JSON.stringify({ answer: "The frame holds the valve.", highlight: [], urgent: false, safety: "", doctor_question: "" });
    const { result, callModel } = await run("What does the frame do?", ["Sure! Here you go: not json at all", `Here: ${good}`]);
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(result.response.message).toBe("The frame holds the valve.");
    expect(result.usedFallback).toBe(false);
  });

  it("still flags emergencies by rule", async () => {
    const { result } = await run("I have chest pain right now", [
      JSON.stringify({ answer: "I am not sure.", highlight: [], urgent: false, safety: "", doctor_question: "" }),
    ]);
    expect(result.response.urgent).toBe(true);
  });

  it("the schema keeps the model inside the retrieved parts", () => {
    const schema = buildLocalSchema(allowedStructureIds(docs)) as { properties: { highlight: { items: { enum: string[] } } } };
    expect(schema.properties.highlight.items.enum).toEqual(expect.arrayContaining(["aortic_valve", "aortic_annulus"]));
    expect(schema.properties.highlight.items.enum).not.toContain("left_coronary_artery");
  });
});
