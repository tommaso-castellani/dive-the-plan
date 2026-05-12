/**
 * Main tRPC router
 * Combines all sub-routers
 */
import { router } from './init';
import { adminRouter } from './routers/admin';
import { authRouter } from './routers/auth';
import { billingRouter } from './routers/billing';
import { chatRouter } from './routers/chat';
import { documentsRouter } from './routers/documents';
import { userRouter } from './routers/user';

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  billing: billingRouter,
  admin: adminRouter,
  documents: documentsRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
