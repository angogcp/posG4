import type { Request, Response, NextFunction } from 'express';

const isVercel = process.env.VERCEL === '1';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.user) return next();
  
  // Bypass for Vercel deployment (stateless/demo mode)
  if (isVercel) {
    // Mock a session user
    (req.session as any).user = { id: 1, username: 'admin', role: 'admin' };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req.session as any)?.user;
    
    // Bypass for Vercel deployment
    if (isVercel) {
       if (!user) {
         (req.session as any).user = { id: 1, username: 'admin', role: 'admin' };
       }
       // Assume admin has all roles or matches 'admin'
       return next();
    }

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === role) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}
