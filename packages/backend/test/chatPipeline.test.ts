import { describe, expect, it, vi } from "vitest";
import { ChatResponseSchema } from "@cal-hacks/shared";
import { EMERGENCY_NOTICE } from "../convex/lib/chatActions";
import { FALLBACK_ANSWER, runChat } from "../convex/lib/chatPipeline";
import { fixtureLookup, promptData } from "./helpers";

const data = promptData();
const lookup = fixtureLookup(data);

function run(message: string, replies: string[], history = [] as { role: "user" | "assistant"; content: string }[]) {
  const callModel = vi.fn();
  for (const text of replies) callModel.mockResolvedValueOnce(text);
  return runChat({ message, data, history, callModel, lookup }).then((result) => ({ result, callModel }));
}

const json = (o: Record<string, unknown>) => JSON.stringify(o);

describe("runChat with a well-behaved model", () => {
  it("returns the answer, a validated highlight, and a side panel from our own content", async () => {
    const { result } = await run("What is the aortic valve? Zoom in.", [
      json({ answer: "It keeps blood from flowing backward.", highlight: ["aortic_valve"], zoom: "in" }),
    ]);
    const r = result.response;
    expect(ChatResponseSchema.safeParse(r).success).toBe(true);
    expect(r.message).toBe("It keeps blood from flowing backward.");
    expect(r.scene_actions).toEqual([
      { type: "focus", structure_id: "aortic_valve" },
      { type: "highlight", structure_ids: ["aortic_valve"], enabled: true },
      { type: "zoom", direction: "in", amount: "medium" },
    ]);
    expect(r.side_panel?.title).toBe("Native aortic valve");
    expect(r.side_panel?.body_markdown).toContain("three-leaflet valve");
    expect(result.usedFallback).toBe(false);
  });
});

describe("runChat with a weaker model", () => {
  it("reads a reply wrapped in a code fence with chatty text", async () => {
    const reply = "Sure, here you go:\n```json\n" + json({ answer: "Here is step 4.", step: "4" }) + "\n```";
    const { result, callModel } = await run("Show me step 4", [reply]);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(result.response.scene_actions).toEqual([{ type: "goto_step", procedure_slug: "tavr", step_index: 4 }]);
  });

  it("retries once when the first reply is not JSON", async () => {
    const { result, callModel } = await run("What is the aorta?", [
      "The aorta is the biggest artery.",
      json({ answer: "The aorta is the biggest artery.", highlight: ["aorta"] }),
    ]);
    expect(callModel).toHaveBeenCalledTimes(2);
    const retryMessages = callModel.mock.calls[1]![0] as { role: string; content: string }[];
    expect(retryMessages[retryMessages.length - 1]!.content).toContain("ONE JSON object");
    expect(result.usedFallback).toBe(false);
    expect(result.response.scene_actions.some((a) => a.type === "highlight")).toBe(true);
  });

  it("uses a safe fallback answer when both replies are unusable", async () => {
    const { result } = await run("Hello", ["nonsense", "still nonsense"]);
    expect(result.usedFallback).toBe(true);
    expect(result.response.message).toBe(FALLBACK_ANSWER);
    expect(result.response.scene_actions).toEqual([]);
    expect(result.response.side_panel).toBeNull();
  });

  it("drops part ids the model invented but keeps the rest of the answer", async () => {
    const { result } = await run("What is this?", [
      json({ answer: "It is a heart part.", highlight: ["liver", "aortic_valve"] }),
    ]);
    // "liver" is not in the content, so the whole highlight action is rejected, but the answer survives
    expect(result.response.message).toBe("It is a heart part.");
    expect(result.response.scene_actions.some((a) => a.type === "highlight")).toBe(false);
    expect(result.rejected.length).toBeGreaterThan(0);
    expect(result.response.side_panel).toBeNull();
  });

  it("drops a step number outside the procedure", async () => {
    const { result } = await run("Show step 9", [json({ answer: "There is no step 9.", step: 9 })]);
    expect(result.response.scene_actions.some((a) => a.type === "goto_step")).toBe(false);
  });

  it("still moves the camera from the patient's own words when the model forgets the commands", async () => {
    const { result } = await run("Rotate the model to the right 90 degrees and zoom out", [
      json({ answer: "Done." }),
    ]);
    expect(result.response.scene_actions).toEqual([
      { type: "zoom", direction: "out", amount: "medium" },
      { type: "rotate", direction: "right", degrees: 90 },
    ]);
  });
});

describe("runChat safety", () => {
  it("answers symptoms happening now with the fixed emergency message, without asking the model", async () => {
    const { result, callModel } = await run("I have chest pain right now", [
      json({ answer: "Chest pain can have many causes.", urgent: false }),
    ]);
    expect(callModel).not.toHaveBeenCalled();
    expect(result.response.urgent).toBe(true);
    expect(result.response.message.startsWith(EMERGENCY_NOTICE)).toBe(true);
    expect(result.response.message).not.toContain("many causes");
    expect(result.safetyEvents).toEqual(["emergency"]);
  });

  it("gives the emergency message even when the model would fail", async () => {
    const { result } = await run("I am having trouble breathing", ["x", "y"]);
    expect(result.response.urgent).toBe(true);
    expect(result.response.message).toContain(EMERGENCY_NOTICE);
  });

  it("keeps safety text and doctor questions from the model", async () => {
    const { result } = await run("Any side effects?", [
      json({
        answer: "Some people feel tired.",
        safety: "Tell your care team about any unusual symptoms.",
        doctor_question: "What should I watch for after the procedure?",
      }),
    ]);
    expect(result.response.safety).toContain("care team");
    expect(result.response.doctor_question).toContain("watch for");
  });
});

describe("runChat camera commands", () => {
  const noModel = async (message: string) => {
    const { result, callModel } = await run(message, []);
    expect(callModel).not.toHaveBeenCalled();
    return result.response;
  };

  it("answers a polite zoom request without asking the model", async () => {
    const r = await noModel("Can you zoom in?");
    expect(r.scene_actions).toEqual([{ type: "zoom", direction: "in", amount: "medium" }]);
    expect(r.message).toBe("Done: zoomed in.");
  });

  it("points at a part named in a show command without asking the model", async () => {
    const r = await noModel("Show me the aortic valve");
    expect(r.scene_actions).toEqual([
      { type: "focus", structure_id: "aortic_valve" },
      { type: "highlight", structure_ids: ["aortic_valve"], enabled: true },
    ]);
    expect(r.message).toBe("Done: showing the native aortic valve.");
    expect(r.side_panel?.title).toBe("Native aortic valve");
  });

  it("can zoom and point at a part in one command", async () => {
    const r = await noModel("Zoom in on the left ventricle");
    expect(r.scene_actions.map((a) => a.type)).toEqual(["focus", "highlight", "zoom"]);
  });

  it("picks the longest part name", async () => {
    const r = await noModel("Show me the ascending aorta");
    expect(r.scene_actions[0]).toEqual({ type: "focus", structure_id: "aorta.ascending" });
  });

  it("still asks the model when the patient wants an explanation", async () => {
    for (const question of ["What is the aortic valve?", "Why does the aortic valve matter?", "Show me what happens to the aortic valve"]) {
      const { callModel } = await run(question, [json({ answer: "It keeps blood from flowing backward." })]);
      expect(callModel).toHaveBeenCalled();
    }
  });
});
