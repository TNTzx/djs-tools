import Djs from "discord.js"

import * as Other from "../other"
import * as Cmds from "../command"
import * as CmdCache from "./cmd_cache"



interface EffectiveTemplate {
    template: Cmds.CmdTemplateLeaf
    useCases: readonly Cmds.UseCase[]
}



function searchSubcommand(
    cmdTemplateGroup: Cmds.CmdTemplateGroup,
    interactionOptions: Omit<Djs.CommandInteractionOptionResolver<Djs.CacheType>, "getMessage" | "getFocused">
): EffectiveTemplate {
    function recursive(nextPath: string[], currentTemplate: Cmds.CmdTemplateType): EffectiveTemplate {
        if (currentTemplate instanceof Cmds.CmdTemplateLeaf) {
            return { template: currentTemplate, useCases: currentTemplate.useCases }
        }

        if (nextPath.length === 0) throw new Error("Command not found.")

        const nextTemplate = currentTemplate.getSubTemplate(nextPath[0])
        if (nextTemplate === undefined) throw new Error("Command not found.")

        const result = recursive(nextPath.slice(1), nextTemplate)
        return { template: result.template, useCases: result.useCases.concat(currentTemplate.useCases) }
    }

    function getPath(optionsData: Djs.CommandInteractionOption<Djs.CacheType>): string[] {
        if (optionsData.options === undefined) throw new Error("Interaction options are invalid.")

        // type >= 3 means not subcommandgroup or subcommand
        if (optionsData.options.length === 0 || optionsData.options[0].type >= 3) return [optionsData.name]
        return [optionsData.name, ...getPath(optionsData.options[0])]
    }

    function expandPath(path: string[]) {
        let newPath: string[] = []
        for (const pathPoint of path) {
            if (pathPoint.includes(Cmds.CmdTemplateGroup.combineIdSeparator)) {
                newPath = newPath.concat(pathPoint.split(Cmds.CmdTemplateGroup.combineIdSeparator))
            } else {
                newPath.push(pathPoint)
            }
        }

        return newPath
    }

    const result = recursive(expandPath(getPath(interactionOptions.data[0])), cmdTemplateGroup)
    return { template: result.template, useCases: result.useCases.concat(cmdTemplateGroup.useCases) }
}



export function addCmdCaller(client: Djs.Client) {
    client.on(Djs.Events.InteractionCreate, async (interaction) => {
        if (!interaction.isCommand()) return
        interaction = interaction as Djs.ChatInputCommandInteraction

        try {
            await interaction.deferReply()
        } catch (error) {
            await interaction.channel?.send("The bot took too long to respond. Please try again.")
            return
        }

        const initialCmdTemplate = CmdCache.getCmdTemplateFromCache(interaction.commandName)

        let effectiveTemplate: EffectiveTemplate

        if (initialCmdTemplate instanceof Cmds.CmdTemplateGroup) {
            const result = searchSubcommand(initialCmdTemplate, interaction.options)
            effectiveTemplate = result
        } else if (initialCmdTemplate instanceof Cmds.CmdTemplateLeaf) {
            effectiveTemplate = {
                template: initialCmdTemplate,
                useCases: initialCmdTemplate.useCases
            }
        } else {
            await interaction.editReply(`\`${interaction.commandName}\` is not a command.`)
            return
        }



        for (const cmdPerm of effectiveTemplate.useCases) {
            const conditionResult = await cmdPerm.isMet(interaction)
            if (conditionResult !== null) {
                await interaction.editReply(`You cannot use this command! ${conditionResult}`)
                return
            }
        }



        try {
            await effectiveTemplate.template.runCmd(interaction)
        } catch (error) {
            if (error instanceof Other.HandleableError) {
                await interaction.editReply(error.getDisplayMessage())
                return
            }

            console.error(error)

            const userDisplay = error instanceof Error ? error.name : typeof error
            const messageContent = `There was an error while executing this command! ${Djs.inlineCode(userDisplay)}`

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(messageContent)
            } else {
                await interaction.channel?.send(messageContent)
            }
        }
    })
}