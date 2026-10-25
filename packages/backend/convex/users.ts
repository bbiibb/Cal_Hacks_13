import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";

// The signed-in user's public profile. No email and no ids: the page only needs to greet the person.
export const viewer = query({
  args: {},
  returns: v.union(v.null(), v.object({ username: v.string(), firstName: v.string(), lastName: v.string() })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null || user.username === undefined || user.firstName === undefined || user.lastName === undefined) {
      return null;
    }
    return { username: user.username, firstName: user.firstName, lastName: user.lastName };
  },
});

// Used by the sign-up check in auth.ts. Internal: not callable by clients (no username enumeration).
export const usernameExists = internalQuery({
  args: { username: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    return user !== null;
  },
});
