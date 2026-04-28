import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type PrismaErrorMessages = {
  duplicate?: string;
  notFound?: string;
  unavailable?: string;
};

export function rethrowPrismaError(
  error: unknown,
  messages: PrismaErrorMessages = {}
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictException(messages.duplicate ?? 'Registro duplicado.');
    }

    if (error.code === 'P2025') {
      throw new NotFoundException(messages.notFound ?? 'Registro nao encontrado.');
    }
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    throw new ServiceUnavailableException(
      messages.unavailable ?? 'Banco de dados indisponivel.'
    );
  }

  throw error;
}
