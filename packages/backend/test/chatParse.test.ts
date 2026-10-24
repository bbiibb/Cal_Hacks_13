import { describe, expect, it } from "vitest";
import { extractJsonObject, parseLlmOutput } from "../convex/lib/chatParse";

const good = {
  answer: "This is the aortic valve.",
  highlight: ["aortic_valve"],
  step: null,
  zoom: "in",
  rotate: null,
  reset_view: false,
  safety: "",
  doctor_question: "",
  urgent: false,
};

describe("extractJsonObject", () => {
  it("reads plain JSON", () => {
    expect(extractJsonObject(JSON.stringify(good))).toEqual(good);
  });

  it("reads JSON inside a code fence", () => {
    expect(extractJsonObject("```json\n" + JSON.stringify(good) + "\n```")).toEqual(good);
    expect(extractJsonObject("```\n" + JSON.stringify(good) + "\n```")).toEqual(good);
  });

  it("reads JSON surrounded by chatty text", () => {
    const text = `Sure! Here is my answer:\n${JSON.stringify(good)}\nHope this helps.`;
    expect(extractJsonObject(text)).toEqual(good);
  });

  it("returns null for text without a JSON object", () => {
    for (const bad of ["", "just words", "[1,2,3]", "{not json}", "null"]) {
      expect(extractJsonObject(bad)).toBeNull();
    }
  });
});

describe("parseLlmOutput", () => {
  it("parses a well-formed reply", () => {
    const out = parseLlmOutput(JSON.stringify(good));
    expect(out).toEqual({
      answer: "This is the aortic valve.",
      highlight: ["aortic_valve"],
      step: null,
      zoom: "in",
      rotate: null,
      resetView: false,
      safety: "",
      doctorQuestion: "",
      urgent: false,
    });
  });

  it("requires an answer", () => {
    expect(parseLlmOutput(JSON.stringify({ ...good, answer: "" }))).toBeNull();
    expect(parseLlmOutput(JSON.stringify({ highlight: ["aorta"] }))).toBeNull();
    expect(parseLlmOutput(JSON.stringify({ ...good, answer: 42 }))).toBeNull();
  });

  it("fills defaults when a small model leaves keys out", () => {
    const out = parseLlmOutput(JSON.stringify({ answer: "Hello" }));
    expect(out).toEqual({
      answer: "Hello",
      highlight: [],
      step: null,
      zoom: null,
      rotate: null,
      resetView: false,
      safety: "",
      doctorQuestion: "",
      urgent: false,
    });
  });

  it("forgives common type slips", () => {
    const out = parseLlmOutput(
      JSON.stringify({
        answer: "ok",
        highlight: " aortic_valve ",
        step: "3",
        zoom: "Zoom In",
        rotate: "LEFT",
        reset_view: "true",
        urgent: "true",
      }),
    );
    expect(out?.highlight).toEqual(["aortic_valve"]);
    expect(out?.step).toBe(3);
    expect(out?.zoom).toBe("in");
    expect(out?.rotate).toEqual({ direction: "left", degrees: 45 });
    expect(out?.resetView).toBe(true);
    expect(out?.urgent).toBe(true);
  });

  it("drops invalid values instead of failing", () => {
    const out = parseLlmOutput(
      JSON.stringify({
        answer: "ok",
        highlight: ["aorta", 5, null, "aorta", ""],
        step: 0,
        zoom: "sideways",
        rotate: { direction: "diagonal", degrees: 30 },
      }),
    );
    expect(out?.highlight).toEqual(["aorta"]);
    expect(out?.step).toBeNull();
    expect(out?.zoom).toBeNull();
    expect(out?.rotate).toBeNull();
  });

  it("clamps rotation degrees to the allowed range", () => {
    const big = parseLlmOutput(JSON.stringify({ answer: "ok", rotate: { direction: "up", degrees: 900 } }));
    const small = parseLlmOutput(JSON.stringify({ answer: "ok", rotate: { direction: "up", degrees: 1 } }));
    const missing = parseLlmOutput(JSON.stringify({ answer: "ok", rotate: { direction: "down" } }));
    expect(big?.rotate?.degrees).toBe(180);
    expect(small?.rotate?.degrees).toBe(5);
    expect(missing?.rotate?.degrees).toBe(45);
  });
});
