/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as chatContext from "../chatContext.js";
import type * as chatStore from "../chatStore.js";
import type * as conditions from "../conditions.js";
import type * as instruments from "../instruments.js";
import type * as lib_cartesia from "../lib/cartesia.js";
import type * as lib_chatActions from "../lib/chatActions.js";
import type * as lib_chatParse from "../lib/chatParse.js";
import type * as lib_chatPipeline from "../lib/chatPipeline.js";
import type * as lib_chatPrompt from "../lib/chatPrompt.js";
import type * as lib_chatRun from "../lib/chatRun.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_localPrompt from "../lib/localPrompt.js";
import type * as lib_mappers from "../lib/mappers.js";
import type * as lib_modelRoute from "../lib/modelRoute.js";
import type * as lib_multipart from "../lib/multipart.js";
import type * as lib_ollama from "../lib/ollama.js";
import type * as lib_rag from "../lib/rag.js";
import type * as lib_ragConfig from "../lib/ragConfig.js";
import type * as lib_ragRun from "../lib/ragRun.js";
import type * as lib_sceneActions from "../lib/sceneActions.js";
import type * as lib_speechRun from "../lib/speechRun.js";
import type * as procedures from "../procedures.js";
import type * as rag from "../rag.js";
import type * as sceneActions from "../sceneActions.js";
import type * as seed from "../seed.js";
import type * as speech from "../speech.js";
import type * as structures from "../structures.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  chatContext: typeof chatContext;
  chatStore: typeof chatStore;
  conditions: typeof conditions;
  instruments: typeof instruments;
  "lib/cartesia": typeof lib_cartesia;
  "lib/chatActions": typeof lib_chatActions;
  "lib/chatParse": typeof lib_chatParse;
  "lib/chatPipeline": typeof lib_chatPipeline;
  "lib/chatPrompt": typeof lib_chatPrompt;
  "lib/chatRun": typeof lib_chatRun;
  "lib/llm": typeof lib_llm;
  "lib/localPrompt": typeof lib_localPrompt;
  "lib/mappers": typeof lib_mappers;
  "lib/modelRoute": typeof lib_modelRoute;
  "lib/multipart": typeof lib_multipart;
  "lib/ollama": typeof lib_ollama;
  "lib/rag": typeof lib_rag;
  "lib/ragConfig": typeof lib_ragConfig;
  "lib/ragRun": typeof lib_ragRun;
  "lib/sceneActions": typeof lib_sceneActions;
  "lib/speechRun": typeof lib_speechRun;
  procedures: typeof procedures;
  rag: typeof rag;
  sceneActions: typeof sceneActions;
  seed: typeof seed;
  speech: typeof speech;
  structures: typeof structures;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
