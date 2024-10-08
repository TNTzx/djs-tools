import Djs from "discord.js"

import * as Other from "../other"
import * as Cmds from "../command"
import * as CmdCache from "./cmd_cache"



interface EffectiveTemplate {
    template: Cmds.CmdTemplateLeaf
    useCases: readonly Cmds.UseCase[]
}


// TODO cmdtemplateleaf no execute function checker


function getPathFromItr(interaction: Djs.ChatInputCommandInteraction): string[] {
    function recursive(optionsData: Djs.CommandInteractionOption): string[] {
        if (optionsData.options === undefined) throw new Error("Interaction options are invalid.")

        // type >= 3 means not subcommandgroup or subcommand
        if (optionsData.options.length === 0 || optionsData.options[0].type >= 3) return [optionsData.name]
        return [optionsData.name, ...recursive(optionsData.options[0])]
    }

    return recursive(interaction.options.data[0])
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


function searchSubcommand(
    cmdTemplateGroup: Cmds.CmdTemplateGroup,
    path: string[]
): EffectiveTemplate {
    function recursive(nextPath: string[], currentTemplate: Cmds.CmdTemplate): EffectiveTemplate {
        if (currentTemplate instanceof Cmds.CmdTemplateLeaf) {
            return { template: currentTemplate, useCases: currentTemplate.useCases }
        }

        if (nextPath.length === 0) throw new Error("Command not found.")

        const nextTemplate = (currentTemplate as Cmds.CmdTemplateGroup).getSubTemplate(nextPath[0])
        if (nextTemplate === undefined) throw new Error("Command not found.")

        const result = recursive(nextPath.slice(1), nextTemplate)
        return { template: result.template, useCases: result.useCases.concat(currentTemplate.useCases) }
    }

    const result = recursive(path, cmdTemplateGroup)
    return { template: result.template, useCases: result.useCases.concat(cmdTemplateGroup.useCases) }
}



export function setupCmdCallerEvent(client: Djs.Client) {
    client.on(Djs.Events.InteractionCreate, async (interaction) => {
        if (!interaction.isCommand()) return
        interaction = interaction as Djs.ChatInputCommandInteraction

        try {
            await interaction.deferReply()
        } catch (error) {
            if (interaction.channel?.isSendable())
                await interaction.channel.send("The bot took too long to respond. Please try again.")
            return
        }

        const initialCmdTemplate = CmdCache.getCachedCmdTemplate(interaction.commandName)

        let effectiveTemplate: EffectiveTemplate

        if (initialCmdTemplate instanceof Cmds.CmdTemplateGroup) {
            const result = searchSubcommand(initialCmdTemplate, expandPath(getPathFromItr(interaction)))
            effectiveTemplate = result
        } else if (initialCmdTemplate instanceof Cmds.CmdTemplateLeaf) {
            effectiveTemplate = {
                template: initialCmdTemplate,
                useCases: initialCmdTemplate.useCases
            }
        } else {
            await interaction.followUp(`\`${interaction.commandName}\` is not a command.`)
            return
        }



        for (const useCase of effectiveTemplate.useCases) {
            const conditionResult = await useCase.isMet(interaction)
            if (conditionResult !== null) {
                await interaction.followUp(`${Djs.bold("You cannot use this command!")}\n` + conditionResult.getDisplayMessage())
                return
            }
        }



        try {
            await effectiveTemplate.template.runCmd(interaction)
        } catch (error) {
            if (error instanceof Other.HandleableError) {
                const message = Djs.bold(Djs.underscore("Error!")) + "\n" + error.getDisplayMessage()
                await interaction.followUp(message)
                return
            }

            console.error(error)

            const userDisplay = error instanceof Error ? error.name : typeof error
            const messageContent = `There was an error while executing this command! ${Djs.inlineCode(userDisplay)}`

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(messageContent)
            } else {
                if (interaction.channel?.isSendable())
                    await interaction.channel.send(messageContent)
            }
        }
    })
}