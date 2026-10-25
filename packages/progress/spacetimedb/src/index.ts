import { schema, table, t, SenderError } from 'spacetimedb/server';

/** Longest procedure slug accepted, in characters. */
const MAX_SLUG_LENGTH = 64;
/** Most steps a procedure can have. */
const MAX_STEPS = 50;

/**
 * One row per person and procedure. It holds viewing progress only: no names, no SSNs, no chat text.
 * The table is private; clients read their own rows through the `my_progress` view.
 */
const stepProgress = table(
  { name: 'step_progress' },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    procedureSlug: t.string(),
    /** The step the person was last looking at. */
    currentStep: t.u32(),
    /** Every step the person has looked at. */
    viewedSteps: t.array(t.u32()),
    updatedAt: t.timestamp(),
  }
);

const spacetimedb = schema({ stepProgress });
export default spacetimedb;

function checkSlug(slug: string): void {
  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) throw new SenderError('Invalid procedure.');
}

/** Records that the caller is now looking at `stepIndex`. Creates the row the first time. */
export const saveProgress = spacetimedb.reducer(
  { procedureSlug: t.string(), stepIndex: t.u32(), totalSteps: t.u32() },
  (ctx, { procedureSlug, stepIndex, totalSteps }) => {
    checkSlug(procedureSlug);
    if (totalSteps === 0 || totalSteps > MAX_STEPS || stepIndex >= totalSteps) {
      throw new SenderError('Invalid step.');
    }

    for (const row of ctx.db.stepProgress.owner.filter(ctx.sender)) {
      if (row.procedureSlug !== procedureSlug) continue;
      const viewedSteps = row.viewedSteps.includes(stepIndex)
        ? row.viewedSteps
        : [...row.viewedSteps, stepIndex].sort((a, b) => a - b);
      ctx.db.stepProgress.id.update({ ...row, currentStep: stepIndex, viewedSteps, updatedAt: ctx.timestamp });
      return;
    }

    ctx.db.stepProgress.insert({
      id: 0n,
      owner: ctx.sender,
      procedureSlug,
      currentStep: stepIndex,
      viewedSteps: [stepIndex],
      updatedAt: ctx.timestamp,
    });
  }
);

/** Forgets the caller's progress in one procedure. */
export const resetProgress = spacetimedb.reducer(
  { procedureSlug: t.string() },
  (ctx, { procedureSlug }) => {
    checkSlug(procedureSlug);
    for (const row of ctx.db.stepProgress.owner.filter(ctx.sender)) {
      if (row.procedureSlug === procedureSlug) ctx.db.stepProgress.id.delete(row.id);
    }
  }
);

/** The caller's own progress rows. A client never receives anyone else's. */
export const myProgress = spacetimedb.view(
  { name: 'my_progress', public: true },
  t.array(stepProgress.rowType),
  (ctx) => [...ctx.db.stepProgress.owner.filter(ctx.sender)]
);
