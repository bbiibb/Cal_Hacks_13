import { makeFunctionReference } from 'convex/server'

export type Viewer = { username: string; firstName: string; lastName: string }

/**
 * The signed-in user, or null. Defined by hand because `convex codegen` has not run yet.
 * TODO: after codegen, replace this with `api.users.viewer`.
 */
export const viewerQuery = makeFunctionReference<'query', Record<string, never>, Viewer | null>('users:viewer')
