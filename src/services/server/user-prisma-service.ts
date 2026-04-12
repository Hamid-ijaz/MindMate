import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Prisma, User as PrismaUser } from '@prisma/client';
import type { User } from '@/lib/types';
import { prisma } from '@/lib/prisma';

const scryptAsync = promisify(scryptCallback);
const PASSWORD_HASH_VERSION = 'scrypt';
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;

export type PublicUser = Pick<User, 'firstName' | 'lastName' | 'email' | 'phone' | 'dob'>;
type UserCreateInput = Pick<PublicUser, 'firstName' | 'lastName' | 'email'> &
  Partial<Pick<PublicUser, 'phone' | 'dob'>> & {
    password?: string;
  };
type UserUpdateInput = Partial<PublicUser> & {
  password?: string;
};

const toPublicUser = (user: PrismaUser): PublicUser => {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? undefined,
    dob: user.dob ?? undefined,
  };
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isHashedPassword = (password: string): boolean => {
  return password.startsWith(`${PASSWORD_HASH_VERSION}$`);
};

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('base64url');
  const derivedKey = (await scryptAsync(password, salt, PASSWORD_KEY_BYTES)) as Buffer;
  return `${PASSWORD_HASH_VERSION}$${salt}$${derivedKey.toString('base64url')}`;
};

const verifyPassword = async (storedPassword: string, providedPassword: string): Promise<boolean> => {
  if (!storedPassword) {
    return false;
  }

  if (!isHashedPassword(storedPassword)) {
    return storedPassword === providedPassword;
  }

  const [version, salt, encodedHash] = storedPassword.split('$');
  if (version !== PASSWORD_HASH_VERSION || !salt || !encodedHash) {
    return false;
  }

  const derivedKey = (await scryptAsync(providedPassword, salt, PASSWORD_KEY_BYTES)) as Buffer;
  const expectedHash = Buffer.from(encodedHash, 'base64url');

  if (derivedKey.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedHash);
};

const toCreateData = (userData: UserCreateInput): Prisma.UserUncheckedCreateInput => {
  const data: Prisma.UserUncheckedCreateInput = {
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: normalizeEmail(userData.email),
  };

  // Explicitly omit undefined fields before writes.
  if (userData.phone !== undefined) {
    data.phone = userData.phone;
  }
  if (userData.dob !== undefined) {
    data.dob = userData.dob;
  }
  if (userData.password !== undefined) {
    data.password = userData.password;
  }

  return data;
};

const toUpdateData = (updates: UserUpdateInput): Prisma.UserUpdateInput => {
  const data: Prisma.UserUpdateInput = {};

  // Explicitly omit undefined fields before writes.
  if (updates.firstName !== undefined) {
    data.firstName = updates.firstName;
  }
  if (updates.lastName !== undefined) {
    data.lastName = updates.lastName;
  }
  if (updates.email !== undefined) {
    data.email = normalizeEmail(updates.email);
  }
  if (updates.phone !== undefined) {
    data.phone = updates.phone;
  }
  if (updates.dob !== undefined) {
    data.dob = updates.dob;
  }
  if (updates.password !== undefined) {
    data.password = updates.password;
  }

  return data;
};

export const userPrismaService = {
  async getUser(email: string): Promise<PublicUser | null> {
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    return user ? toPublicUser(user) : null;
  },

  async userExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { email: true },
    });

    return !!user;
  },

  async createUser(userData: UserCreateInput): Promise<PublicUser> {
    const createPayload = {
      ...userData,
      password: userData.password ? await hashPassword(userData.password) : undefined,
    };

    const createdUser = await prisma.user.create({
      data: toCreateData(createPayload),
    });

    return toPublicUser(createdUser);
  },

  async updateUser(email: string, updates: UserUpdateInput): Promise<PublicUser | null> {
    const updatePayload = {
      ...updates,
      password: updates.password ? await hashPassword(updates.password) : undefined,
    };
    const updateData = toUpdateData(updatePayload);

    if (Object.keys(updateData).length === 0) {
      return this.getUser(email);
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { email: normalizeEmail(email) },
        data: updateData,
      });

      return toPublicUser(updatedUser);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },

  async validateCredentials(email: string, password: string): Promise<PublicUser | null> {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.password) {
      return null;
    }

    const isValidPassword = await verifyPassword(user.password, password);
    if (!isValidPassword) {
      return null;
    }

    if (!isHashedPassword(user.password)) {
      const migratedPassword = await hashPassword(password);
      await prisma.user
        .update({
          where: { email: normalizedEmail },
          data: { password: migratedPassword },
        })
        .catch(() => undefined);
    }

    return toPublicUser(user);
  },
};
