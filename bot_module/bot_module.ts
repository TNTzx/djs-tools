import Djs from "discord.js"

import * as Cmds from "../command"
import * as GuildSetup from "./db_guild_setup"
import * as CmdCache from "./cmd_cache"
import * as CmdCaller from "./cmd_caller"



export class BotModule {
    public id: Lowercase<string>
    public dbGuildSetupper: GuildSetup.DBGuildSetupper | null
    public cmdTemplates: Cmds.CmdTemplate[]

    constructor(args: {
        id: Lowercase<string>
        dbGuildSetupper?: GuildSetup.DBGuildSetupper
        cmdTemplates: Cmds.CmdTemplate[]
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

    GuildSetup.setupDbGuildSetupperEvent(
        botClient,
        getAllModules()
            .map(botModule => botModule.dbGuildSetupper)
            .filter(dbGuildSetupper => dbGuildSetupper !== null) as GuildSetup.DBGuildSetupper[]
        )

    CmdCaller.setupCmdCallerEvent(botClient)
}