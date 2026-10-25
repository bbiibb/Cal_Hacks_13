import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { makeFunctionReference } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import { authError, buildProfile, mapLibraryError, validatePassword } from "./lib/authProfile";

type Authorize = (params: Record<string, unknown>, ctx: AuthorizeCtx) => Promise<unknown>;
type AuthorizeCtx = { runQuery: (ref: typeof usernameExists, args: { username: string }) => Promise<boolean> };

// users.ts:usernameExists, referenced by name so this file does not depend on regenerated api types.
const usernameExists = makeFunctionReference<"query", { username: string }, boolean>("users:usernameExists");

const password = Password<DataModel>({
  // The library calls this for every flow, including signIn. It must be synchronous.
  profile: (params) => buildProfile(params) as never,
  validatePasswordRequirements: validatePassword,
});

// The library throws plain Errors and silently signs in on a duplicate sign-up with the same password.
// Wrap its authorize step to (1) reject duplicate usernames and (2) translate its errors to ConvexError codes.
const options = (password as unknown as { options?: { authorize?: Authorize } }).options;
const innerAuthorize = options?.authorize;
if (options === undefined || typeof innerAuthorize !== "function") {
  throw new Error("Convex Auth Password provider changed shape; update convex/auth.ts");
}
options.authorize = async (params, ctx) => {
  try {
    if (typeof params.password !== "string") throw authError("invalid_request");
    if (params.flow === "signUp") {
      const profile = buildProfile(params); // validate before touching the database
      validatePassword(params.password);
      if (await ctx.runQuery(usernameExists, { username: profile.username })) throw authError("username_taken");
    } else if (params.flow !== "signIn") {
      throw authError("invalid_request"); // reset / verification flows are not enabled
    }
    return await innerAuthorize(params, ctx);
  } catch (error) {
    throw mapLibraryError(error) ?? error;
  }
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
});
