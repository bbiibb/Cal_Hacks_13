import { describe, expect, it, vi } from "vitest";
import { runChat } from "../convex/lib/chatPipeline";
import { buildMessages as buildCloudMessages } from "../convex/lib/chatPrompt";
import { buildLocalMessages, buildLocalSchema, LOCAL_FORMAT_LINE } from "../convex/lib/localPrompt";
import { allowedStructureIds, keywordDocs, mergeDocs, pinnedDocs, docFromChunk } from "../convex/lib/rag";
import { REFUSALS, containsMedicalAdvice, withGroupStatisticsNote, checkGrounding, knowledgeTexts, numberFacts } from "../convex/lib/safety";
import { knowledgeFor } from "../convex/lib/knowledge";
import { fixtureLookup, promptData } from "./helpers";

const data = promptData({ currentStepIndex: 2 });
const reply = (o: Record<string, unknown>) =>
  JSON.stringify({ answer: "", highlight: [], urgent: false, safety: "", doctor_question: "", ...o });

/** Runs the local pipeline the way modelRoute sets it up: retrieved knowledge in the prompt, sources from the same documents. */
async function askLocal(message: string, modelReply: string) {
  const docs = mergeDocs(pinnedDocs(data), keywordDocs(data, message));
  const allowed = allowedStructureIds(docs, new Set(data.structures.map((s) => s.id)));
  const callModel = vi.fn().mockResolvedValue(modelReply);
  const result = await runChat({
    message,
    data,
    history: [],
    callModel,
    buildMessages: (d, h, m) => buildLocalMessages(d, h, m, docs, allowed),
    contextDocs: docs,
    lookup: fixtureLookup(data),
  });
  return { r: result.response, result, callModel, docs };
}

describe("local prompt with the reference material", () => {
  const message = "How likely is a stroke?";
  const docs = mergeDocs(pinnedDocs(data), keywordDocs(data, message));
  const ids = allowedStructureIds(docs, new Set(data.structures.map((s) => s.id)));
  const messages = buildLocalMessages(data, [], message, docs, ids);
  const system = messages[0]!.content;

  it("puts the matching facts into the context, numbered, with their part ids", () => {
    expect(docs.some((d) => d.docId === "knowledge:risk.stroke")).toBe(true);
    expect(system).toContain("Risk: stroke");
    expect(system).toContain("1% to 3%");
  });

  it("lists the part ids a fact is about, so the model can highlight them", () => {
    const question = "Can TAVR cause a heart attack?";
    const heartDocs = mergeDocs(pinnedDocs(data), keywordDocs(data, question));
    const heartIds = allowedStructureIds(heartDocs, new Set(data.structures.map((s) => s.id)));
    const text = buildLocalMessages(data, [], question, heartDocs, heartIds)[0]!.content;
    expect(text).toMatch(/\[\d\] Risk: heart attack \(part ids: left_coronary_artery, right_coronary_artery\)/);
    expect(text).toContain("ALLOWED IDS: ");
  });

  it("asks for group statistics, no invented numbers, and no medicine advice", () => {
    expect(system).toMatch(/groups of patients, not the patient's own risk/);
    expect(system).toMatch(/Never add others/);
    expect(system).toMatch(/Never tell the patient to start, stop, or change a medicine/);
  });

  it("ends with the exact JSON format and the five keys the pipeline reads", () => {
    expect(system.endsWith(LOCAL_FORMAT_LINE)).toBe(true);
    for (const key of ["answer", "highlight", "urgent", "safety", "doctor_question"]) expect(LOCAL_FORMAT_LINE).toContain(`"${key}"`);
    const schema = buildLocalSchema(ids) as { required: string[] };
    expect(schema.required).toEqual(["answer", "highlight", "urgent", "safety", "doctor_question"]);
  });

  it("shows two valid JSON examples: an answer from the facts and an 'I am not sure'", () => {
    const examples = messages.filter((m) => m.role === "assistant").map((m) => JSON.parse(m.content) as Record<string, unknown>);
    expect(examples).toHaveLength(2);
    for (const e of examples) expect(Object.keys(e).sort()).toEqual(["answer", "doctor_question", "highlight", "safety", "urgent"]);
    expect(String(examples[1]!.answer)).toMatch(/not sure/);
  });

  it("stays small enough for a 2048-token window even with the longest facts and a full history", () => {
    const longest = [...knowledgeFor("tavr")].sort((a, b) => b.text.length - a.text.length).slice(0, 4).map(docFromChunk);
    const full = mergeDocs(pinnedDocs(promptData({ currentStepIndex: 1, selectedStructureId: "aortic_valve" })), longest);
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: "x".repeat(300),
    }));
    const chars = buildLocalMessages(data, history, "A question of normal length about the procedure?", full).reduce((n, m) => n + m.content.length, 0);
    // about 4 characters per token; leave room for the 300-token answer
    expect(chars / 4).toBeLessThan(1500);
  });
});

describe("cloud prompt with the reference material", () => {
  it("adds the best-matching facts and keeps the output format last", () => {
    const reference = keywordDocs(data, "Will I need a pacemaker?", 3);
    const system = buildCloudMessages(data, [], "Will I need a pacemaker?", reference)[0]!.content;
    expect(system).toContain("REFERENCE");
    expect(system).toContain("8% to 20%");
    expect(system.indexOf("REFERENCE")).toBeLessThan(system.indexOf("OUTPUT FORMAT"));
    expect(system.trimEnd().endsWith('"urgent": boolean}')).toBe(true);
  });

  it("is unchanged when there is no reference", () => {
    const system = buildCloudMessages(data, [], "Hi")[0]!.content;
    expect(system).not.toContain("REFERENCE");
  });
});

describe("answers about the procedure's risks", () => {
  it("accepts an answer that matches the published percentage, adds the group-statistics note, and cites the fact", async () => {
    const { r, result } = await askLocal(
      "How likely is a stroke?",
      reply({ answer: "A disabling stroke happens in about 1% to 3% of patients, when small pieces of calcium or clots travel to the brain." }),
    );
    expect(result.safetyEvents).toEqual([]);
    expect(r.message).toContain("1% to 3%");
    expect(r.message).toContain("not your personal risk");
    expect(r.sources).toEqual([{ title: "Risk: stroke (TAVR patient information guide)", url: null }]);
    expect(r.safety).not.toBe("");
  });

  it("accepts the same fact written as '3 to 8 percent'", async () => {
    const { r, result } = await askLocal(
      "Can I bleed during TAVR?",
      reply({ answer: "Major bleeding that may need a blood transfusion occurs in about 3 to 8 percent of cases, because the groin artery is punctured." }),
    );
    expect(result.safetyEvents).toEqual([]);
    expect(r.message).toContain("3 to 8 percent");
    expect(r.message).toContain("groups of patients");
  });

  it("replaces a percentage that is not in the material", async () => {
    const { r, result } = await askLocal("How likely is a stroke?", reply({ answer: "A stroke happens in about 12% of patients." }));
    expect(result.safetyEvents).toContain("ungrounded");
    expect(r.message).not.toContain("12%");
    expect(r.message).toContain("Here is what I can share");
    expect(r.message).toContain("1% to 3%");
    expect(r.sources[0]?.title).toBe("Risk: stroke (TAVR patient information guide)");
  });

  it("does not turn a published group statistic into a promise about the patient", async () => {
    const { r } = await askLocal("What are the chances of a pacemaker?", reply({ answer: "A permanent pacemaker is needed in about 8% to 20% of patients." }));
    expect(r.message).toMatch(/not your personal risk/);
  });

  it("does not repeat the note when the model already said it", () => {
    const answer = "About 2% to 5% of patients, as a group statistic and not your own risk.";
    expect(withGroupStatisticsNote(answer)).toBe(answer);
    expect(withGroupStatisticsNote("No numbers here.")).toBe("No numbers here.");
  });
});

describe("medicines", () => {
  it("lets through the caution that comes from the material: do not stop unless the care team says so", () => {
    expect(containsMedicalAdvice("Do not stop or change any medicine, including blood thinners, unless your care team tells you to.")).toBe(false);
    expect(containsMedicalAdvice("Please don't stop taking your medicines unless your doctor tells you to.")).toBe(false);
  });

  it("still blocks real advice, even next to the caution", () => {
    expect(containsMedicalAdvice("You should stop taking your blood thinner two days before.")).toBe(true);
    expect(containsMedicalAdvice("Stop taking your aspirin. Do not stop anything else unless your care team tells you to.")).toBe(true);
    expect(containsMedicalAdvice("Do not stop your pills. Take 81 mg every day.")).toBe(true);
  });

  it("the fixed reply to a medicine question carries the same caution", () => {
    expect(REFUSALS.medication_advice.message).toMatch(/do not stop or change any medicine unless your care team tells you to/);
  });

  it("answers from the material about telling the care team, without advice", async () => {
    const { r, result } = await askLocal(
      "What do I tell my care team about my medicines before TAVR?",
      reply({ answer: "Tell your care team about all medicines and supplements you take. Do not stop or change any medicine unless your care team tells you to." }),
    );
    expect(result.safetyEvents).toEqual([]);
    expect(r.message).toContain("Tell your care team");
  });
});

describe("grounding with the reference material", () => {
  it("knows the facts of the material", () => {
    const texts = knowledgeTexts(data);
    const answer = "The new valve is made of cow or pig tissue sewn into a collapsible metal frame.";
    expect(checkGrounding(answer, texts, "What is the new valve made of?").grounded).toBe(true);
  });

  it("still rejects a claim the material does not make", () => {
    const texts = knowledgeTexts(data);
    const answer = "The valve is guaranteed to last 25 years and gets covered by every insurance plan.";
    const result = checkGrounding(answer, texts, "How long does it last?");
    expect(result.grounded).toBe(false);
    expect(result.ungroundedNumbers).toContain("25");
  });

  it("does not let a plain number borrow a percentage unless the answer talks about percentages", () => {
    const texts = knowledgeTexts(data);
    expect(checkGrounding("The cafeteria opens at 7 and closes at 9 in the evening.", texts, "When is lunch?").ungroundedNumbers).toEqual(["7", "9"]);
  });
});

describe("highlighting the parts a fact is about", () => {
  it("lets the model highlight parts that come from the knowledge it was given", async () => {
    const { r, docs } = await askLocal(
      "Can TAVR cause a heart attack?",
      reply({
        answer: "A heart attack is very rare, in less than 1% of procedures; the new valve's frame could block the openings of the coronary arteries.",
        highlight: ["left_coronary_artery", "right_coronary_artery"],
      }),
    );
    expect(docs.some((d) => d.docId === "knowledge:risk.heart_attack")).toBe(true);
    expect(r.scene_actions).toContainEqual({ type: "highlight", structure_ids: ["left_coronary_artery", "right_coronary_artery"], enabled: true });
  });
});

describe("numbers must match the material with their unit", () => {
  const texts = knowledgeTexts(data);

  it("reads numbers with their units", () => {
    const facts = numberFacts("About 3% to 8%, or 3 to 8 percent; 1 to 2 days; a 30-day rate; 10+ years; 8 pm.").map((f) => `${f.value}${f.unit === "%" ? "%" : ` ${f.unit}`}`);
    expect(facts).toEqual(["3%", "8%", "3%", "8%", "1 day", "2 day", "30 day", "10 year", "8 pm"]);
  });

  it("rejects a lifetime the model made up, even though 20 and 30 appear elsewhere in the material", () => {
    // Seen from the real 3B model: the digits exist in the material ("8% to 20%", "30-day"), the claim does not.
    const result = checkGrounding("The new valve typically lasts decades, with some lasting 20 to 30 years or more.", texts, "How long will the new valve last?");
    expect(result.grounded).toBe(false);
    expect(result.ungroundedNumbers).toEqual(expect.arrayContaining(["20", "30"]));
  });

  it("accepts figures the material gives, written in different ways", () => {
    for (const answer of [
      "The hospital stay is usually 1 to 2 days.",
      "Have someone stay with you for the first 24 to 48 hours.",
      "Bleeding needing a transfusion occurs in about 3%-8% of cases.",
      "Death within 30 days is roughly 1 to 3 percent.",
    ]) {
      expect(checkGrounding(answer, texts, "question").ungroundedNumbers).toEqual([]);
    }
  });
});

describe("an off-topic question", () => {
  it("gets the plain 'I don't have an answer' reply without an unrelated question for the doctor", async () => {
    const { r } = await askLocal(
      "Who won the football game last night?",
      reply({ answer: "The Warriors beat the Lakers after a dramatic overtime.", doctor_question: "What are the signs of a complication after TAVR?" }),
    );
    expect(r.message).toBe("I don't have a reliable answer to that in the information I have. Please ask your care team.");
    expect(r.doctor_question).toBe("");
    expect(r.sources).toEqual([]);
  });
});

describe("questions about the patient's own suitability", () => {
  it("are not answered by the model: eligibility is the care team's decision", async () => {
    for (const text of ["Am I too young for TAVR?", "Am I a good candidate for TAVR?", "Am I eligible for TAVR?"]) {
      const callModel = vi.fn();
      const result = await runChat({ message: text, data, history: [], callModel, lookup: fixtureLookup(data) });
      expect(callModel).not.toHaveBeenCalled();
      expect(result.response.message).toBe(REFUSALS.personal_medical.message);
    }
  });

  it("general questions about who can have TAVR still reach the model", async () => {
    const { callModel } = await askLocal("Who can have TAVR?", reply({ answer: "Your team looks at your symptoms, your valve, and your risk from surgery." }));
    expect(callModel).toHaveBeenCalled();
  });

  it("a model that rules on the patient personally is replaced", () => {
    for (const answer of ["You may be too young for TAVR.", "You are a good candidate for TAVR.", "You are not suitable for TAVR."]) {
      expect(containsMedicalAdvice(answer)).toBe(true);
    }
    expect(containsMedicalAdvice("Younger patients are often steered toward surgery instead.")).toBe(false);
  });
});

describe("camera commands", () => {
  it("do not call the model at all and still produce the scene actions", async () => {
    const callModel = vi.fn();
    const result = await runChat({ message: "Zoom in and rotate it left 60 degrees", data, history: [], callModel, lookup: fixtureLookup(data) });
    expect(callModel).not.toHaveBeenCalled();
    expect(result.response.scene_actions).toEqual([
      { type: "zoom", direction: "in", amount: "medium" },
      { type: "rotate", direction: "left", degrees: 60 },
    ]);
    expect(result.response.message).not.toBe("");
  });

  it("an emergency is never treated as a camera command", async () => {
    const callModel = vi.fn().mockResolvedValue(reply({ answer: "Call emergency services now." }));
    const result = await runChat({ message: "Zoom in, I have chest pain", data, history: [], callModel, lookup: fixtureLookup(data) });
    expect(callModel).toHaveBeenCalled();
    expect(result.response.urgent).toBe(true);
  });
});
