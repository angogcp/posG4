import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req.session as any)?.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === role) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}