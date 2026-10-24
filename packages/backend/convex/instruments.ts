import { v } from "convex/values";
import { query } from "./_generated/server";
import { toInstrument } from "./lib/mappers";
import { vInstrument } from "./validators";

const MAX_INSTRUMENTS = 200;

/** All surgical instruments (ordered by instrument_id) */
export const list = query({
  args: {},
  returns: v.array(vInstrument),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("instruments")
      .withIndex("by_instrument_id")
      .take(MAX_INSTRUMENTS);
    return docs.map(toInstrument);
  },
});
