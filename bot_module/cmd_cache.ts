import * as Cmds from "../command"



const cmdTemplateCache: Map<string, Cmds.CmdTemplateType> = new Map()
export function getCmdTemplatesCache() { return cmdTemplateCache }
export function addCmdTemplateToCache<CmdTemplateT>(cmdTemplate: CmdTemplateT) {
    const typedCmdTemplate = cmdTemplate as Cmds.CmdTemplateType
    if (cmdTemplateCache.has(typedCmdTemplate.id)) throw new Error(`Command ${cmdTemplate} is a duplicate and is already registered.`)

    cmdTemplateCache.set(typedCmdTemplate.id, typedCmdTemplate)
}

export function cacheCmdTemplates<CmdTemplateT>(cmdTemplates: CmdTemplateT[]) {
    for (const cmdTemplate of cmdTemplates) addCmdTemplateToCache(cmdTemplate)
}

export function getCmdTemplateFromCache(id: string) {
    return cmdTemplateCache.get(id)
}