import Djs from "discord.js"
import { Prisma } from "@prisma/client"

import * as DjsTPrisma from "../prisma"



export function getGuildCreateData(guildSid: string): Prisma.GuildCreateInput {
    return {
        guildSid: guildSid
    }
}

export function getGuildWhereUnique(guildSid: string): Prisma.GuildWhereUniqueInput {
    return { guildSid: guildSid }
}


export async function addGuildToDB(guildSid: string) {
    return await DjsTPrisma.getPrismaClient().guild.create({
        data: getGuildCreateData(guildSid)
    })
}

export async function deleteGuildFromDB(guildSid: string) {
    return await DjsTPrisma.getPrismaClient().guild.delete({
        where: getGuildWhereUnique(guildSid)
    })
}

export async function updateGuildsDB(botGuildSids: string[]) {
    const prismaClient = DjsTPrisma.getPrismaClient()


    const prismaGuildEntries = await prismaClient.guild.findMany()
    const prismaGuildSids = prismaGuildEntries.map(prismaGuildEntry => prismaGuildEntry.guildSid)

    const toAddGuildSids = botGuildSids.filter(botGuildSid => !prismaGuildSids.includes(botGuildSid))
    const createdEntries = toAddGuildSids.length !== 0
        ? await prismaClient.$transaction(toAddGuildSids.map(
            toAddGuildSid => prismaClient.guild.create({ data: getGuildCreateData(toAddGuildSid) })
        ))
        : null

    const toDeleteGuildSids = prismaGuildSids.filter(prismaGuildSid => !botGuildSids.includes(prismaGuildSid))
    const deletedEntries = toDeleteGuildSids.length !== 0
        ? await prismaClient.$transaction(toDeleteGuildSids.map(
            toDeleteGuildSid => prismaClient.guild.delete({ where: getGuildWhereUnique(toDeleteGuildSid) })
        ))
        : null

    return { createdEntries: createdEntries, deletedEntries: deletedEntries }
}



export class DBGuildSetupper {
    public isAlreadySetup: (guildSid: string) => Promise<boolean>
    public setup: (guildSid: string) => Prisma.GuildUpdateInput

    constructor(
        args: {
            isAlreadySetup: (guildSid: string) => Promise<boolean>,
            getSetupData: (guildSid: string) => Prisma.GuildUpdateInput
        }
    ) {
        this.isAlreadySetup = args.isAlreadySetup
        this.setup = args.getSetupData
    }
}

export function mergeSetupDatas(dbGuildSetuppers: DBGuildSetupper[], guildSid: string) {
    return Object.assign({}, ...(dbGuildSetuppers.map(setupper => setupper.setup(guildSid)))) as Prisma.GuildUpdateInput
}

export async function setupGuildConditional(guildSid: string, dbGuildSetuppers: DBGuildSetupper[]) {
    const mergedSetupDatas = mergeSetupDatas(dbGuildSetuppers, guildSid)

    for (const dbGuildSetupper of dbGuildSetuppers) {
        if (!(await dbGuildSetupper.isAlreadySetup(guildSid))) {
            await DjsTPrisma.getPrismaClient().guild.update({
                where: {guildSid: guildSid},
                data: mergedSetupDatas
            })
        }
    }
}


export function addDbGuildSetupperEvent(botClient: Djs.Client, dbGuildSetuppers: DBGuildSetupper[]) {
    botClient.on(Djs.Events.GuildCreate, async guild => {
        await addGuildToDB(guild.id)
        await setupGuildConditional(guild.id, dbGuildSetuppers)
    })

    botClient.on(Djs.Events.GuildDelete, async guild => {
        await deleteGuildFromDB(guild.id)
    })

    botClient.on(Djs.Events.ClientReady, async client => {
        const allGuildSids = client.guilds.cache.map(guild => guild.id)

        console.log("Updating guild list...")
        await updateGuildsDB(allGuildSids)

        console.log("Setting up all guilds...")
        const allDbGuildSetuppers = dbGuildSetuppers
        for (const guildSid of allGuildSids) {
            await setupGuildConditional(guildSid, allDbGuildSetuppers)
        }

        console.log("Finished setting up database for all guilds.")
    })
}
