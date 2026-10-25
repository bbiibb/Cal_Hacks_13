import { describe, expect, it } from "vitest";
import { knowledgeFor, searchKnowledge, searchTerms } from "../convex/lib/knowledge";
import { fuseRankings, keywordDocs, pickSources, docFromChunk, type RetrievedDoc } from "../convex/lib/rag";
import { promptData } from "./helpers";

const chunks = knowledgeFor("tavr");

describe("knowledge base", () => {
  it("is bundled for TAVR and empty for an unknown procedure", () => {
    expect(chunks.length).toBeGreaterThan(50);
    expect(knowledgeFor("cholecystectomy")).toEqual([]);
  });
});

describe("searchTerms", () => {
  it("lower-cases, stems, and drops filler words but keeps short medical terms", () => {
    expect(searchTerms("What are the risks of a CT scan?")).toEqual(["risk", "ct", "scan"]);
    expect(searchTerms("Can I drive after TAVR?")).toEqual(["driv", "after", "tavr"]);
  });
});

/**
 * Questions a patient might ask, with the knowledge chunk that should answer each. The chunk must be among the
 * top three keyword results. This is the quality check of the knowledge base: when a question is added here and
 * fails, fix the chunk's questions or keywords in the fixture.
 */
const QUESTIONS: [string, string][] = [
  ["What is TAVR?", "overview.what_is_tavr"],
  ["Am I awake during the procedure?", "overview.benefits"],
  ["What is aortic stenosis?", "condition.aortic_stenosis"],
  ["Why do I feel short of breath and dizzy?", "condition.symptoms"],
  ["Who can have TAVR?", "candidacy.indications"],
  ["Can I have TAVR if I have COPD?", "candidacy.unsuitable_lung"],
  ["Can I have TAVR if I have kidney disease?", "candidacy.unsuitable_kidney_liver"],
  ["Can I have TAVR with an infection?", "candidacy.unsuitable_infection"],
  ["How long will the new valve last?", "comparison.valve_durability"],
  ["What if my valve is bicuspid?", "comparison.anatomy_and_other_heart_issues"],
  ["Where does the catheter go in?", "anatomy.femoral_artery"],
  ["What is the aortic arch?", "anatomy.aortic_arch"],
  ["What is the right atrium?", "anatomy.right_atrium"],
  ["What does the right ventricle do?", "anatomy.right_ventricle"],
  ["What is the superior vena cava?", "anatomy.superior_vena_cava"],
  ["What is the pulmonary artery?", "anatomy.pulmonary_artery"],
  ["Is the old valve taken out?", "overview.principle"],
  ["Will my chest be opened?", "procedure.vs_open_surgery_incision"],
  ["What is transapical TAVR?", "procedure.approaches_common"],
  ["What is subclavian TAVR?", "procedure.approaches_types"],
  ["TAVR or open-heart surgery, which is better?", "comparison.tavr_vs_savr"],
  ["Am I too young for TAVR?", "comparison.age_younger"],
  ["Am I too old for open-heart surgery?", "comparison.age_older"],
  ["Will I need blood thinners after TAVR?", "comparison.blood_thinners"],
  ["What is the guidewire for?", "instrument.guidewire"],
  ["What is the new valve made of?", "instrument.prosthetic_valve"],
  ["How does the balloon work?", "instrument.balloon"],
  ["Why does my heart beat fast during the procedure?", "instrument.temporary_pacemaker"],
  ["What are the risks of TAVR?", "risk.overview"],
  ["How likely is a stroke?", "risk.stroke"],
  ["Will I need a pacemaker afterwards?", "risk.pacemaker"],
  ["Can TAVR hurt my kidneys?", "risk.kidney"],
  ["Can the new valve leak?", "risk.valve_leak_slip"],
  ["Can I bleed from the groin?", "risk.bleeding"],
  ["Can TAVR cause a heart attack?", "risk.heart_attack"],
  ["What is the chance of dying from TAVR?", "risk.death"],
  ["What is endocarditis?", "risk.infection"],
  ["What tests do I need before TAVR?", "prep.tests_imaging"],
  ["Do I need to see the dentist?", "prep.dental"],
  ["When should I stop eating and drinking?", "prep.fasting"],
  ["What should I pack for the hospital?", "prep.what_to_bring"],
  ["Can I wear nail polish?", "prep.jewelry_nails"],
  ["Can I keep my contact lenses in?", "prep.remove_before"],
  ["Who drives me home?", "prep.recovery_planning"],
  ["How long is the hospital stay?", "recovery.hospital_stay"],
  ["When can I exercise again?", "recovery.exercise"],
  ["Can I travel by plane after TAVR?", "recovery.travel"],
  ["I am nervous about the procedure", "recovery.anxiety"],
  ["Can I have TAVR if I am pregnant?", "faq.pregnancy"],
  ["Can children have TAVR?", "faq.children"],
  ["I have diabetes, can I have TAVR?", "faq.diabetes"],
  ["When should I call 911?", "safety.emergency"],
  ["The groin is red and swollen after I went home", "safety.after_procedure_warning_signs"],
];

describe("keyword search finds the right fact", () => {
  for (const [question, expected] of QUESTIONS) {
    it(`"${question}" -> ${expected}`, () => {
      const top = searchKnowledge(chunks, question, 3).map((c) => c.id);
      expect(top).toContain(expected);
    });
  }

  it("returns the best chunk first for an exact term", () => {
    expect(searchKnowledge(chunks, "pacemaker", 1)[0]?.id).toMatch(/pacemaker/);
  });

  it("returns nothing for words that are not in the material", () => {
    expect(searchKnowledge(chunks, "football cafeteria", 3)).toEqual([]);
    expect(searchKnowledge(chunks, "", 3)).toEqual([]);
  });
});

describe("fuseRankings", () => {
  const doc = (id: string): RetrievedDoc => ({ docId: id, kind: "knowledge", title: id, text: id });

  it("puts a document that both searches found before documents found by one", () => {
    const fused = fuseRankings([[doc("a"), doc("b"), doc("c")], [doc("c"), doc("d")]], 4);
    expect(fused[0]?.docId).toBe("c");
    expect(fused.map((d) => d.docId).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("respects the limit and works with one empty list", () => {
    expect(fuseRankings([[], [doc("a"), doc("b")]], 1).map((d) => d.docId)).toEqual(["a"]);
    expect(fuseRankings([[], []], 3)).toEqual([]);
  });
});

describe("keywordDocs", () => {
  it("turns the results into documents the prompt can use", () => {
    const docs = keywordDocs(promptData(), "How likely is a stroke?", 2);
    expect(docs[0]?.docId).toBe("knowledge:risk.stroke");
    expect(docs[0]?.kind).toBe("knowledge");
    expect(docs[0]?.sourceTitle).toBe("Risk: stroke (TAVR patient information guide)");
  });

  it("finds nothing when the procedure has no knowledge", () => {
    expect(keywordDocs(promptData({ knowledge: undefined }), "stroke")).toEqual([]);
  });
});

describe("pickSources", () => {
  const stroke = docFromChunk(chunks.find((c) => c.id === "risk.stroke")!) as RetrievedDoc;
  const kidney = docFromChunk(chunks.find((c) => c.id === "risk.kidney")!) as RetrievedDoc;

  it("cites the fact that the answer actually uses, not every document in the prompt", () => {
    const sources = pickSources("A disabling stroke happens in about 1% to 3% when pieces of calcium or clots travel to the brain.", [kidney, stroke]);
    expect(sources).toEqual([{ title: "Risk: stroke (TAVR patient information guide)", url: null }]);
  });

  it("cites nothing when the answer shares too little with the documents", () => {
    expect(pickSources("I am not sure about that.", [stroke, kidney])).toEqual([]);
  });

  it("never cites parts or steps, only knowledge", () => {
    const step: RetrievedDoc = { docId: "step:tavr:1", kind: "step", title: "Delivering", text: "The catheter carries the new valve across the narrowed valve." };
    expect(pickSources("The catheter carries the new valve across the narrowed valve.", [step])).toEqual([]);
  });
});
