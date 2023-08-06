import Djs from "discord.js"

import * as Cmds from "../command"
import * as GuildSetup from "./db_guild_setup"
import * as CmdCache from "./cmd_cache"
import * as CmdCaller from "./cmd_caller"



export class BotModule<CmdTemplates extends Cmds.CmdTemplateType | unknown = unknown> {
    public id: Lowercase<string>
    public dbGuildSetupper: GuildSetup.DBGuildSetupper | null
    public cmdTemplates: CmdTemplates

    constructor(args: {
        id: Lowercase<string>
        dbGuildSetupper?: GuildSetup.DBGuildSetupper
        cmdTemplates: CmdTemplates
    }) {
        this.id = args.id
        this.dbGuildSetupper = args.dbGuildSetupper ?? null
        this.cmdTemplates = args.cmdTemplates
    }
}


const botModules: BotModule[] = []
export function getAllModules() { return botModules }
export function addBotModule(botModule: BotModule) {
    botModules.push(botModule)
}

export function setupCaches() {
    CmdCache.cacheCmdTemplates(botModules.map(botModule => botModule.cmdTemplates).flat(1))
}



export async function setupClient(botClient: Djs.Client) {
    setupCaches()

    GuildSetup.addDbGuildSetupperEvent(
        botClient,
        getAllModules()
            .map(botModule => botModule.dbGuildSetupper)
            .filter(dbGuildSetupper => dbGuildSetupper !== null) as GuildSetup.DBGuildSetupper[]
        )

    CmdCaller.addCmdCaller(botClient)
}