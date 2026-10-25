import { ChatRequestSchema } from "@cal-hacks/shared";
import { describe, expect, it } from "vitest";
import { validateAudio } from "../convex/lib/cartesia";
import { voiceQuestion } from "../convex/lib/speechText";

const context = { procedure_slug: "tavr", step_index: 0, selected_structure_id: null };

describe("voiceQuestion", () => {
  it("leaves a normal spoken question alone and tidies spaces", () => {
    expect(voiceQuestion("  What are   the risks of TAVR?  ")).toBe("What are the risks of TAVR?");
  });

  it("cuts a very long recording at the last whole sentence that fits", () => {
    const sentence = "I have been wondering about the procedure and what happens afterwards. ";
    const long = sentence.repeat(12) + "Is it painful?";
    const q = voiceQuestion(long);
    expect(q.length).toBeLessThanOrEqual(500);
    expect(q.endsWith(".")).toBe(true);
    expect(long.startsWith(q)).toBe(true);
  });

  it("cuts at a word when there is no sentence end, never inside a word", () => {
    const long = "word ".repeat(200);
    const q = voiceQuestion(long);
    expect(q.length).toBeLessThanOrEqual(500);
    expect(q.endsWith("word")).toBe(true);
  });

  it("copes with one very long word", () => {
    expect(voiceQuestion("x".repeat(900)).length).toBe(500);
  });

  it("always produces a question the chat request accepts", () => {
    for (const text of ["Short?", "a ".repeat(400), "Sentence one. ".repeat(100), "x".repeat(2000)]) {
      const parsed = ChatRequestSchema.safeParse({ message: voiceQuestion(text), context });
      expect(parsed.success, text.slice(0, 20)).toBe(true);
    }
  });
});

describe("the formats the browser recorder produces", () => {
  // These are the types voice_recorder.ts tries, in order (Chrome and Firefox: webm or ogg, Safari: mp4)
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    it(`${type} is accepted`, () => {
      expect(validateAudio(30_000, type).extension).toMatch(/^(webm|ogg|mp4)$/);
    });
  }

  it("a 30 second recording is far below the size limit", () => {
    // Opus at about 32 kbit/s is 4 kB per second
    expect(() => validateAudio(30 * 4_000, "audio/webm;codecs=opus")).not.toThrow();
  });
});
