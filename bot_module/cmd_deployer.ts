import Djs from "discord.js"

import * as CmdCache from "./cmd_cache"
import * as BotModule from "./bot_module"



export async function deployCmdsGuildBased(client: Djs.Client, botToken: string, appId: string) {
    const restApi = new Djs.REST()
    restApi.setToken(botToken)

    BotModule.setupCaches()

    const registeredCmdTemplateMap = CmdCache.getCmdTemplatesCache()

    console.log("Logging into client for deploying slash commands (guild based)...")
    await client.login(botToken)


    const cmdDatas = [...registeredCmdTemplateMap.values()].map(cmdTemplate => cmdTemplate.createBuilder().toJSON())

    try {
        console.log(`Refreshing ${registeredCmdTemplateMap.size} slash commands:`)
        for (const cmdTemplate of registeredCmdTemplateMap.values())
            console.log(cmdTemplate.getDeployDisplay())

        const guilds = [...client.guilds.cache.values()]
        for (const [idx, guild] of guilds.entries()) {
            console.log(`Registering to guild ${idx + 1} of ${guilds.length}: ${guild.name} (${guild.id})...`)
            await restApi.put(
                Djs.Routes.applicationGuildCommands(appId, guild.id),
                { body: cmdDatas },
            )
        }

        console.log("Successfully refreshed and deployed all slash commands.")

        client.destroy()
    } catch (error) {
        console.error(error)
    }
}