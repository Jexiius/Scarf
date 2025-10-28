import type { UserPayload } from './user';

export type AppBindings = {
  Variables: {
    user?: UserPayload;
    requestId?: string;
  };
};
