import { makeFunctionReference } from 'convex/server'

export type Viewer = { username: string; firstName: string; lastName: string }

/**
 * The signed-in user, or null (the `viewer` query in packages/backend/convex/users.ts).
 * Typed by hand on purpose: the frontend does not depend on the backend package, only on this name and shape.
 */
export const viewerQuery = makeFunctionReference<'query', Record<string, never>, Viewer | null>('users:viewer')
