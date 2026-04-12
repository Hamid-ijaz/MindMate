import { Accomplishment as PrismaAccomplishment } from '@prisma/client';
import type { Accomplishment } from '@/lib/types';
import { prisma } from '@/lib/prisma';

const toAccomplishment = (accomplishment: PrismaAccomplishment): Accomplishment => {
  return {
    id: accomplishment.id,
    date: accomplishment.date,
    content: accomplishment.content,
  };
};

export const accomplishmentPrismaService = {
  async getAccomplishments(userEmail: string): Promise<Accomplishment[]> {
    const accomplishments = await prisma.accomplishment.findMany({
      where: { userEmail },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return accomplishments.map(toAccomplishment);
  },

  async getAccomplishmentById(userEmail: string, id: string): Promise<Accomplishment | null> {
    const accomplishment = await prisma.accomplishment.findFirst({
      where: { id, userEmail },
    });

    return accomplishment ? toAccomplishment(accomplishment) : null;
  },

  async addAccomplishment(userEmail: string, accomplishment: Omit<Accomplishment, 'id'>): Promise<string> {
    const createdAccomplishment = await prisma.accomplishment.create({
      data: {
        userEmail,
        date: accomplishment.date,
        content: accomplishment.content,
      },
      select: { id: true },
    });

    return createdAccomplishment.id;
  },

  async deleteAccomplishment(userEmail: string, id: string): Promise<boolean> {
    const result = await prisma.accomplishment.deleteMany({
      where: { id, userEmail },
    });

    return result.count > 0;
  },
};