import * as Cmds from "../command"



const cmdTemplateCache: Map<string, Cmds.CmdTemplate> = new Map()
export function getCmdTemplatesCache() { return cmdTemplateCache }
export function cacheCmdTemplate(cmdTemplate: Cmds.CmdTemplate) {
    if (cmdTemplateCache.has(cmdTemplate.id)) throw new Error(`Command ${cmdTemplate.id} is a duplicate and is already registered.`)

    cmdTemplateCache.set(cmdTemplate.id, cmdTemplate)
}

export function cacheCmdTemplates(cmdTemplates: Cmds.CmdTemplate[]) {
    for (const cmdTemplate of cmdTemplates) cacheCmdTemplate(cmdTemplate)
}

export function getCachedCmdTemplate(id: string) {
    return cmdTemplateCache.get(id)
}