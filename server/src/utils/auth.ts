import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'levela-mvp-secret-key-change-in-production';
const JWT_EXPIRES_IN = '30d';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
