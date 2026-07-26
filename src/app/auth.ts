import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { IncidentRepo } from '../domain/ports.js';

export function createAuthApp(repo: IncidentRepo, secret: string) {
  return {
    async login(email: string, password: string) {
      const user = await repo.findUserByEmail(email);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
      const token = jwt.sign({ sub: user.id }, secret, { algorithm: 'HS256', expiresIn: '24h' });
      const { passwordHash: _passwordHash, ...publicUser } = user;
      return { token, user: publicUser };
    },
  };
}
