import { ChatResponseSchema, type ChatResponse } from "@cal-hacks/shared";
import { EMERGENCY_NOTICE, buildSceneActions, detectUrgent } from "./chatActions";
import { parseLlmOutput } from "./chatParse";
import {
  buildMessages,
  type ChatTurn,
  type LlmMessage,
  type PromptData,
} from "./chatPrompt";
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
  lookup: SceneActionLookup;
}

export interface ChatPipelineResult {
  response: ChatResponse;
  /** Actions the validator dropped, with the reason. For logs. */
  rejected: RejectedSceneAction[];
  /** True when the model's answer could not be read and the fallback answer was used. */
  usedFallback: boolean;
}

/**
 * The whole chatbot turn, without any database or network of its own:
 * prompt -> model -> forgiving JSON parse (one retry) -> scene actions -> validation -> response.
 */
export async function runChat(input: ChatPipelineInput): Promise<ChatPipelineResult> {
  const messages = buildMessages(input.data, input.history, input.message);
  const urgentByRule = detectUrgent(input.message);

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
    };
  }

  const candidates = buildSceneActions(output, {
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

  const urgent = output.urgent || urgentByRule;
  const mentionsEmergency = /\b(911|112|999|emergency)\b/i.test(output.answer);
  const message = urgent && !mentionsEmergency ? `${EMERGENCY_NOTICE} ${output.answer}` : output.answer;

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
      safety: output.safety,
      doctor_question: output.doctorQuestion,
      urgent,
    }),
    rejected,
    usedFallback: false,
  };
}
