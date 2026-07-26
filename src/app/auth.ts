import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { IncidentRepo } from '../domain/ports.js';

export const DUMMY_PASSWORD_HASH = '$2a$10$mSLtSG1TOPBPy13x4P6v2.2GQzAbuxs8Bq.AOk5D1vPF0z154Fq7G';

export function createAuthApp(
  repo: IncidentRepo,
  secret: string,
  compare: (password: string, hash: string) => Promise<boolean> = bcrypt.compare,
) {
  return {
    async login(email: string, password: string) {
      const user = await repo.findUserByEmail(email);
      const passwordMatches = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (!user || !passwordMatches) return null;
      const token = jwt.sign({ sub: user.id }, secret, { algorithm: 'HS256', expiresIn: '24h' });
      const { passwordHash: _passwordHash, ...publicUser } = user;
      return { token, user: publicUser };
    },
  };
}
