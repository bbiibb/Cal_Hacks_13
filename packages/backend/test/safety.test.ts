import { describe, expect, it } from "vitest";
import {
  checkGrounding,
  classifyRequest,
  containsMedicalAdvice,
  contentWords,
  extractiveAnswer,
  knowledgeTexts,
  needsSafetyNote,
  redactPersonalInfo,
} from "../convex/lib/safety";
import { promptData } from "./helpers";

describe("classifyRequest", () => {
  it("blocks requests about taking, stopping, or changing medicines", () => {
    for (const text of [
      "Should I stop taking my blood thinner before the procedure?",
      "Which medicine should I stop taking?",
      "Can I skip my pills tomorrow?",
      "Tell me which medicine to stop taking",
      "What dose of aspirin should I take?",
      "How many mg should I take?",
      "Is it okay if I double my dose",
      "Do I need to take blood thinners after the procedure?",
    ]) {
      expect(classifyRequest(text), text).toBe("medication_advice");
    }
  });

  it("blocks requests for a diagnosis or a personal decision", () => {
    for (const text of [
      "Do I have aortic stenosis?",
      "Can you diagnose me?",
      "What is wrong with me?",
      "Will I die during the procedure?",
      "Should I get the TAVR surgery?",
      "Is it safe for me?",
      "Can you interpret my echo results?",
      "My ECG results look bad, what do they mean?",
    ]) {
      expect(classifyRequest(text), text).toBe("personal_medical");
    }
  });

  it("lets ordinary educational questions through", () => {
    for (const text of [
      "What is the aortic valve?",
      "Why does the valve narrow?",
      "Will I have chest pain after the procedure?",
      "What does a blood thinner do?",
      "How does the new valve expand?",
      "Zoom in please",
      "Where are the coronary arteries?",
      "What is the recovery like in general?",
    ]) {
      expect(classifyRequest(text), text).toBe("ok");
    }
  });
});

describe("containsMedicalAdvice", () => {
  it("catches instructions, doses, and diagnoses in an answer", () => {
    for (const text of [
      "You should stop taking your aspirin before the procedure.",
      "I recommend that you skip the next dose.",
      "Take 81 mg every day.",
      "You probably have a blockage in one artery.",
      "There is no need to see a doctor about this.",
      "It is safe for you to stop your medicine.",
      "You must continue taking the pills.",
    ]) {
      expect(containsMedicalAdvice(text), text).toBe(true);
    }
  });

  it("does not flag normal explanations or advice to ask the care team", () => {
    for (const text of [
      "The new valve takes over so blood flows in one direction.",
      "Please ask your care team about your medicines.",
      "If the pain is severe, contact your doctor or emergency services.",
      "You should call your local emergency number right away.",
    ]) {
      expect(containsMedicalAdvice(text), text).toBe(false);
    }
  });
});

describe("checkGrounding", () => {
  const data = promptData();
  const sources = knowledgeTexts(data);

  it("accepts answers made from our own content", () => {
    for (const answer of [
      "The aortic annulus is the ring of tissue that the aortic valve is attached to.",
      "No, once the catheter and guidewire are withdrawn, the new valve takes over, so blood flows in only one direction.",
      "The frame holds the new valve and anchors it in the annulus. Here is step 3.",
    ]) {
      expect(checkGrounding(answer, sources, "What is this?").grounded, answer).toBe(true);
    }
  });

  it("rejects invented numbers", () => {
    const result = checkGrounding("The valve lasts about 15 years and works in 98% of patients.", sources, "How long does it last?");
    expect(result.grounded).toBe(false);
    expect(result.ungroundedNumbers).toEqual(expect.arrayContaining(["15", "98%"]));
  });

  it("accepts a number that the patient or the content already used", () => {
    expect(checkGrounding("Step 3 shows the frame.", sources, "show step 3").grounded).toBe(true);
    expect(checkGrounding("That is about 15 years, as you said.", sources, "Does it last 15 years?").ungroundedNumbers).toEqual([]);
  });

  it("rejects answers full of terms that are not in our content", () => {
    const result = checkGrounding(
      "The lifespan varies between patients depending on durability, calcium turnover, and anticoagulation therapy.",
      sources,
      "How long will it last?",
    );
    expect(result.grounded).toBe(false);
    expect(result.novelWords.length).toBeGreaterThanOrEqual(3);
  });

  it("treats very short answers and camera replies as fine", () => {
    expect(checkGrounding("Done.", sources, "zoom in").grounded).toBe(true);
    expect(checkGrounding("I zoomed in and turned the view left.", sources, "zoom in").grounded).toBe(true);
  });
});

describe("extractiveAnswer", () => {
  const data = promptData();

  it("answers with our own text for the best matching snippet", () => {
    const result = extractiveAnswer(data, "What is the annulus?");
    expect(result.message).toContain("I don't have a reliable answer");
    expect(result.message).toContain("ring of tissue");
    expect(result.structureId).toBe("aortic_annulus");
  });

  it("does not use a snippet that shares only a common word", () => {
    const result = extractiveAnswer(data, "How many years will the new valve last?");
    expect(result.structureId).toBeUndefined();
    expect(result.message).not.toContain("Here is what I can share");
  });

  it("admits it does not know when nothing matches", () => {
    const result = extractiveAnswer(data, "Who won the football game?");
    expect(result.message).toContain("ask your care team");
    expect(result.structureId).toBeUndefined();
  });
});

describe("redactPersonalInfo", () => {
  it("removes emails, phone numbers, ID-like numbers, and birth dates", () => {
    const text = "I am anna.k@example.com, call me on 555-123-4567, id 123456789, born 04/12/1961, SSN 123-45-6789.";
    const { text: clean, found } = redactPersonalInfo(text);
    for (const secret of ["anna.k@example.com", "555-123-4567", "123456789", "04/12/1961", "123-45-6789"]) {
      expect(clean).not.toContain(secret);
    }
    expect(found).toEqual(expect.arrayContaining(["email", "ssn", "phone", "date_of_birth", "number"]));
  });

  it("leaves ordinary questions alone, including short numbers", () => {
    const text = "Take me to step 3 and rotate it 90 degrees";
    expect(redactPersonalInfo(text)).toEqual({ text, found: [] });
  });
});

describe("misc", () => {
  it("adds the standing note only for risk and recovery topics", () => {
    expect(needsSafetyNote("What are the side effects?")).toBe(true);
    expect(needsSafetyNote("Is it painful?")).toBe(true);
    expect(needsSafetyNote("What is the aortic valve?")).toBe(false);
  });

  it("reduces words to a comparable form", () => {
    const [a, b] = [contentWords("valve"), contentWords("valves")];
    expect(a).toEqual(b);
    expect(contentWords("anchored anchoring")).toEqual(["anchor", "anchor"]);
    expect(contentWords("the and with")).toEqual([]);
  });
});
