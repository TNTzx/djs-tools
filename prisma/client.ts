import Prisma from "@prisma/client"


const prismaClient = new Prisma.PrismaClient()

export function getPrismaClient() {
    return prismaClient
}