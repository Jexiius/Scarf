import { compare, hash } from 'bcrypt';
import { sign } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { env } from '../config/env';
import { UserRepository } from '../repositories/user.repository';
import type { InsertUser, User } from '../db/schema';
import { ValidationError, UnauthorizedError, AppError } from '../utils/errors';
import type { UserPayload } from '../types/user';

export interface AuthResult {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

const BCRYPT_ROUNDS = 12;

export class AuthService {
  constructor(private readonly usersRepo = new UserRepository()) {}

  async register(params: { email: string; password: string; name?: string | undefined }) {
    const email = params.email.trim().toLowerCase();
    const existing = await this.usersRepo.findByEmail(email);
    if (existing) {
      throw new ValidationError('Email is already registered');
    }

    const passwordHash = await hash(params.password, BCRYPT_ROUNDS);
    const user = await this.usersRepo.create({
      email,
      passwordHash,
      name: params.name?.trim() ?? null,
    } satisfies InsertUser);

    const token = await this.signToken(user);
    return { token, user: this.stripPassword(user) } satisfies AuthResult;
  }

  async login(params: { email: string; password: string }) {
    const email = params.email.trim().toLowerCase();
    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await compare(params.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const updated = await this.usersRepo.updateLastLogin(user.id);
    const userRecord = updated ?? user;
    const token = await this.signToken(userRecord);

    return { token, user: this.stripPassword(userRecord) } satisfies AuthResult;
  }

  private async signToken(user: User): Promise<string> {
    if (!env.JWT_SECRET) {
      throw new AppError(500, 'JWT secret not configured');
    }

    const payload: UserPayload & JWTPayload = {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };

    return sign(payload, env.JWT_SECRET);
  }

  private stripPassword(user: User) {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }
}
