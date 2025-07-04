// Extend Express Request interface to include user property
declare namespace Express {
  interface Request {
    user?: any;
  }
}
