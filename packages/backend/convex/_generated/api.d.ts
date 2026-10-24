/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as conditions from "../conditions.js";
import type * as instruments from "../instruments.js";
import type * as lib_mappers from "../lib/mappers.js";
import type * as lib_sceneActions from "../lib/sceneActions.js";
import type * as procedures from "../procedures.js";
import type * as sceneActions from "../sceneActions.js";
import type * as seed from "../seed.js";
import type * as structures from "../structures.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  conditions: typeof conditions;
  instruments: typeof instruments;
  "lib/mappers": typeof lib_mappers;
  "lib/sceneActions": typeof lib_sceneActions;
  procedures: typeof procedures;
  sceneActions: typeof sceneActions;
  seed: typeof seed;
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
