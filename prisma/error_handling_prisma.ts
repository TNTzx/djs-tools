import { Prisma } from "@prisma/client"



export function isPrismaErrorUniqueNotExists(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
}

export function isPrismaErrorAlreadyExists(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}