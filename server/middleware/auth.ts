import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
  userEmail?: string
  userRole?: string
}

const JWT_SECRET = process.env.JWT_SECRET || ''
if (!JWT_SECRET) {
  console.warn('[Auth] JWT_SECRET no configurada — tokens no podrán verificarse')
}

interface JwtPayload {
  sub: string
  email: string
  role: string
  iat?: number
  exp?: number
}

function verifyToken(token: string): { userId: string; userEmail: string; userRole: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (!decoded.sub) return null
    return { userId: decoded.sub, userEmail: decoded.email, userRole: decoded.role || 'member' }
  } catch {
    return null
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }
  const result = verifyToken(authHeader.substring(7))
  if (!result) {
    res.status(401).json({ error: 'Token inválido' })
    return
  }
  req.userId = result.userId
  req.userEmail = result.userEmail
  req.userRole = result.userRole
  next()
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const result = verifyToken(authHeader.substring(7))
    if (result) {
      req.userId = result.userId
      req.userEmail = result.userEmail
      req.userRole = result.userRole
    }
  }
  next()
}
