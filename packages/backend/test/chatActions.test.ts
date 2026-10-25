import { describe, expect, it } from "vitest";
import { SceneActionSchema } from "@cal-hacks/shared";
import { buildSceneActions, describeCameraCommands, detectUrgent, detectViewCommands } from "../convex/lib/chatActions";
import type { LlmOutput } from "../convex/lib/chatParse";

const empty: LlmOutput = {
  answer: "ok",
  highlight: [],
  step: null,
  zoom: null,
  rotate: null,
  resetView: false,
  safety: "",
  doctorQuestion: "",
  urgent: false,
};
const context = { procedureSlug: "tavr", stepCount: 4, currentStepIndex: 0, message: "tell me about it" };

describe("detectUrgent", () => {
  it("flags symptoms happening now", () => {
    for (const text of [
      "I have chest pain right now",
      "I'm having trouble breathing",
      "I feel like I'm going to faint",
      "I think I'm having a stroke",
      "My chest pain won't stop and I am scared",
      "I have heavy bleeding from the wound",
    ]) {
      expect(detectUrgent(text), text).toBe(true);
    }
  });

  it("does not flag questions about the future or general questions", () => {
    for (const text of [
      "Will I have chest pain after the procedure?",
      "What is a stroke?",
      "How long does the valve last?",
      "Can fainting happen after TAVR?",
    ]) {
      expect(detectUrgent(text), text).toBe(false);
    }
  });
});

describe("detectViewCommands", () => {
  it("reads zoom commands and their size", () => {
    expect(detectViewCommands("Zoom in please").zoom).toEqual({ direction: "in", amount: "medium" });
    expect(detectViewCommands("zoom in a little").zoom).toEqual({ direction: "in", amount: "small" });
    expect(detectViewCommands("Zoom out a lot").zoom).toEqual({ direction: "out", amount: "large" });
    expect(detectViewCommands("Can I get closer?").zoom).toEqual({ direction: "in", amount: "medium" });
  });

  it("reads rotate commands and degrees", () => {
    expect(detectViewCommands("Rotate it to the left").rotate).toEqual({ direction: "left", degrees: 45 });
    expect(detectViewCommands("turn the model right 90 degrees").rotate).toEqual({ direction: "right", degrees: 90 });
    expect(detectViewCommands("tilt it up 400 degrees").rotate?.degrees).toBe(180);
  });

  it("reads reset and step commands", () => {
    expect(detectViewCommands("reset the view").resetView).toBe(true);
    expect(detectViewCommands("go back to the original view").resetView).toBe(true);
    expect(detectViewCommands("Take me to step 3").step).toBe(3);
  });

  it("ignores ordinary questions", () => {
    const none = detectViewCommands("What is the aortic valve and why does it narrow?");
    expect(none).toEqual({ zoom: null, rotate: null, resetView: false, step: null });
  });
});

describe("describeCameraCommands", () => {
  it("confirms what was done in plain words", () => {
    expect(describeCameraCommands(detectViewCommands("zoom in and rotate left 60 degrees"), 4)).toBe(
      "Done: zoomed in, turned the view left 60 degrees.",
    );
    expect(describeCameraCommands(detectViewCommands("tilt it up 30 degrees"), 4)).toBe("Done: tilted the view up 30 degrees.");
    expect(describeCameraCommands(detectViewCommands("reset the view"), 4)).toBe("Done: reset the view.");
    expect(describeCameraCommands(detectViewCommands("take me to step 3"), 4)).toBe("Done: moved to step 3.");
    expect(describeCameraCommands(detectViewCommands("take me to step 9"), 4)).toBe("Done.");
  });
});

describe("buildSceneActions", () => {
  it("builds focus and highlight from the highlighted parts", () => {
    const actions = buildSceneActions({ ...empty, highlight: ["aortic_valve", "aorta"] }, context);
    expect(actions).toEqual([
      { type: "focus", structure_id: "aortic_valve" },
      { type: "highlight", structure_ids: ["aortic_valve", "aorta"], enabled: true },
    ]);
  });

  it("limits highlights to three parts", () => {
    const actions = buildSceneActions({ ...empty, highlight: ["a", "b", "c", "d", "e"] }, context);
    const highlight = actions.find((a) => a.type === "highlight");
    expect(highlight && highlight.type === "highlight" && highlight.structure_ids).toEqual(["a", "b", "c"]);
  });

  it("builds step, zoom, rotate, and reset actions from the model's answer", () => {
    const actions = buildSceneActions(
      { ...empty, step: 3, zoom: "out", rotate: { direction: "right", degrees: 60 }, resetView: true },
      context,
    );
    expect(actions).toEqual([
      { type: "goto_step", procedure_slug: "tavr", step_index: 3 },
      { type: "zoom", direction: "out", amount: "medium" },
      { type: "rotate", direction: "right", degrees: 60 },
      { type: "reset_view" },
    ]);
  });

  it("does not go to the step the patient is already on", () => {
    expect(buildSceneActions({ ...empty, step: 0 }, context)).toEqual([]);
    expect(buildSceneActions({ ...empty, step: 2 }, { ...context, currentStepIndex: 2 })).toEqual([]);
    expect(buildSceneActions({ ...empty, step: 3 }, { ...context, currentStepIndex: 2 })).toHaveLength(1);
  });

  it("goes to step 0, the introduction, from another step", () => {
    expect(buildSceneActions({ ...empty, step: 0 }, { ...context, currentStepIndex: 2 })).toEqual([
      { type: "goto_step", procedure_slug: "tavr", step_index: 0 },
    ]);
    expect(detectViewCommands("Go to step 0").step).toBe(0);
    expect(describeCameraCommands(detectViewCommands("go to step 0"), 4)).toBe("Done: moved to step 0.");
  });

  it("ignores a step number outside the procedure", () => {
    expect(buildSceneActions({ ...empty, step: 9 }, context)).toEqual([]);
    expect(buildSceneActions({ ...empty, step: 4 }, context)).toEqual([]); // the procedure has steps 0 to 3
    expect(buildSceneActions({ ...empty, step: -1 }, context)).toEqual([]);
  });

  it("falls back to the patient's own words when the model leaves the commands out", () => {
    const actions = buildSceneActions(empty, { ...context, message: "Please zoom in and rotate left 30 degrees" });
    expect(actions).toEqual([
      { type: "zoom", direction: "in", amount: "medium" },
      { type: "rotate", direction: "left", degrees: 30 },
    ]);
  });

  it("only builds actions that follow the contract", () => {
    const actions = buildSceneActions(
      { ...empty, highlight: ["aorta"], step: 2, zoom: "in", rotate: { direction: "up", degrees: 20 }, resetView: true },
      context,
    );
    for (const action of actions) expect(SceneActionSchema.safeParse(action).success).toBe(true);
  });
});
