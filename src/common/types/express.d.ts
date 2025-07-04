import type { User } from '../../../generated/prisma';

// Extend Express Request interface to include authUser property
declare global {
  namespace Express {
    interface Request {
      authUser?: User;
    }
  }
}
