import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { upsertAdminUser } from '../db/queries.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  adminRecord?: {
    id: number;
    uid: string;
    email: string;
    fullName: string | null;
    role: string;
    isActive: boolean;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const adminRecord = await upsertAdminUser(
      decodedToken.uid,
      decodedToken.email || 'unknown@toyaairtravels.com',
      decodedToken.name || null
    );

    if (!adminRecord.isActive) {
      return res.status(403).json({ error: 'Forbidden: Admin account is deactivated' });
    }

    req.adminRecord = adminRecord;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
};
