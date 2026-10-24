import { ChatResponseSchema, type ChatResponse } from "@cal-hacks/shared";
import { EMERGENCY_NOTICE, buildSceneActions, describeCameraCommands, detectUrgent, detectViewCommands } from "./chatActions";
import { parseLlmOutput } from "./chatParse";
import {
  buildMessages,
  type ChatTurn,
  type LlmMessage,
  type PromptData,
} from "./chatPrompt";
import {
  REFUSALS,
  SAFETY_NOTE,
  checkGrounding,
  classifyRequest,
  containsMedicalAdvice,
  extractiveAnswer,
  knowledgeTexts,
  needsSafetyNote,
} from "./safety";
import { validateSceneActions, type SceneActionLookup, type RejectedSceneAction } from "./sceneActions";

export const FALLBACK_ANSWER =
  "Sorry, I could not put that into words just now. Please try asking again, or ask your care team.";

const RETRY_REMINDER =
  'Your last reply was not valid. Reply again with ONE JSON object only, using the keys answer, highlight, step, zoom, rotate, reset_view, safety, doctor_question, urgent.';

export interface ChatPipelineInput {
  message: string;
  data: PromptData;
  history: ChatTurn[];
  /** Sends messages to the model and returns its raw text. Injected so tests can use a fake. */
  callModel: (messages: LlmMessage[]) => Promise<string>;
  /** Builds the prompt. Defaults to the cloud prompt; the local pipeline passes its own shorter one. */
  buildMessages?: (data: PromptData, history: ChatTurn[], message: string) => LlmMessage[];
  lookup: SceneActionLookup;
}

export interface ChatPipelineResult {
  response: ChatResponse;
  /** Actions the validator dropped, with the reason. For logs. */
  rejected: RejectedSceneAction[];
  /** True when the model's answer could not be read and the fallback answer was used. */
  usedFallback: boolean;
  /** What the safety layer did, for example "blocked:medication_advice" or "ungrounded". Never contains text. */
  safetyEvents: string[];
}

/** An answer where the model itself declines or defers to the care team is fine as it is. */
const DECLINES = /\b(can'?t|cannot|can not|unable to|not able to|don'?t have|do not have|not sure)\b[^.?!]*\b(care team|doctor|pharmacist|medical team|provide|help|advice|information)\b/i;

/** "Zoom in" or "go to step 3": a command, not a medical question. */
function isCameraOnly(message: string): boolean {
  const c = detectViewCommands(message);
  const hasCommand = c.zoom !== null || c.rotate !== null || c.resetView || c.step !== null;
  return hasCommand && !message.includes("?") && message.length < 80;
}

/**
 * The whole chatbot turn, without any database or network of its own:
 * prompt -> model -> forgiving JSON parse (one retry) -> scene actions -> validation -> response.
 */
export async function runChat(input: ChatPipelineInput): Promise<ChatPipelineResult> {
  const urgentByRule = detectUrgent(input.message);

  // Safety gate: personal medical decisions never reach the model (emergencies are handled below)
  if (!urgentByRule) {
    const kind = classifyRequest(input.message);
    if (kind !== "ok") {
      return {
        response: ChatResponseSchema.parse({
          message: REFUSALS[kind].message,
          scene_actions: [],
          side_panel: null,
          sources: [],
          safety: SAFETY_NOTE,
          doctor_question: REFUSALS[kind].doctorQuestion,
          urgent: false,
        }),
        rejected: [],
        usedFallback: false,
        safetyEvents: [`blocked:${kind}`],
      };
    }
  }

  const messages = (input.buildMessages ?? buildMessages)(input.data, input.history, input.message);

  let output = parseLlmOutput(await input.callModel(messages));
  if (!output) {
    // One retry with a reminder: cheap, and fixes many format slips of small models.
    output = parseLlmOutput(
      await input.callModel([...messages, { role: "user", content: RETRY_REMINDER }]),
    );
  }

  if (!output) {
    return {
      response: ChatResponseSchema.parse({
        message: urgentByRule ? `${EMERGENCY_NOTICE} ${FALLBACK_ANSWER}` : FALLBACK_ANSWER,
        scene_actions: [],
        side_panel: null,
        sources: [],
        urgent: urgentByRule,
      }),
      rejected: [],
      usedFallback: true,
      safetyEvents: ["model_reply_unreadable"],
    };
  }

  // Safety checks on what the model wrote
  const safetyEvents: string[] = [];
  const urgent = output.urgent || urgentByRule;
  let answer = output.answer;
  let highlight = output.highlight;
  let doctorQuestion = output.doctorQuestion;
  let safety = output.safety;

  if (!urgent && isCameraOnly(input.message)) {
    // A pure camera command gets a fixed confirmation; the model's wording and highlights are not used
    answer = describeCameraCommands(detectViewCommands(input.message), input.data.steps.length);
    highlight = [];
  } else if (containsMedicalAdvice(answer)) {
    answer = REFUSALS.advice_filtered.message;
    doctorQuestion = REFUSALS.advice_filtered.doctorQuestion;
    highlight = [];
    safetyEvents.push("advice_filtered");
  } else if (!urgent && !DECLINES.test(answer)) {
    const grounding = checkGrounding(answer, knowledgeTexts(input.data), input.message);
    if (!grounding.grounded) {
      const own = extractiveAnswer(input.data, input.message);
      answer = own.message;
      highlight = own.structureId ? [own.structureId] : [];
      doctorQuestion = doctorQuestion || "Can you tell me more about this?";
      safetyEvents.push("ungrounded");
    }
  }
  if (safetyEvents.length > 0 || needsSafetyNote(input.message)) safety = safety || SAFETY_NOTE;

  const candidates = buildSceneActions({ ...output, highlight }, {
    procedureSlug: input.data.procedureSlug,
    stepCount: input.data.steps.length,
    currentStepIndex: input.data.currentStepIndex,
    message: input.message,
  });
  const { accepted, rejected } = await validateSceneActions(candidates, input.lookup);

  // The side panel comes from our own content, not from the model, so it cannot be invented.
  const highlighted = accepted.find((a) => a.type === "highlight");
  const firstPart =
    highlighted && highlighted.type === "highlight"
      ? input.data.structures.find((s) => s.id === highlighted.structure_ids[0])
      : undefined;

  const mentionsEmergency = /\b(911|112|999|emergency)\b/i.test(answer);
  const message = urgent && !mentionsEmergency ? `${EMERGENCY_NOTICE} ${answer}` : answer;

  return {
    response: ChatResponseSchema.parse({
      message,
      scene_actions: accepted,
      side_panel: firstPart
        ? {
            title: firstPart.name,
            body_markdown: firstPart.description,
            related_structure_ids: [firstPart.id],
          }
        : null,
      sources: [],
      safety,
      doctor_question: doctorQuestion,
      urgent,
    }),
    rejected,
    usedFallback: false,
    safetyEvents,
  };
}
