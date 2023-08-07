import Djs from "discord.js"

import * as Other from "../other"
import * as ParamParser from "./param_parser"
import * as UseCase from "./use_case"
import * as UseScope from "./use_scope"


type Params = (readonly unknown[]) | null
type ParamValueMap<ParamsT extends Params> = ParamsT extends null ? undefined : ParamParser.ParamsToValueMap<ParamsT>
type ExecuteFunc<UseScopeT extends UseScope.UseScope, ParamsT extends Params> =
    (
        interaction: UseScopeT extends UseScope.UseScope ? UseScope.UseScopeToInteractionMap<UseScopeT> : UseScope.MergeScopeCommandInteraction,
        args: ParamValueMap<ParamsT>
    ) => Promise<Other.HandleableError | void>
type UseCases<UseScopeT extends UseScope.UseScope = UseScope.UseScope> = readonly UseCase.UseCase<UseScopeT>[]



export class HErrorCommand extends Other.HandleableError {
    private __nominalAssertFailCommand() {}
}



type CmdTemplateGroupArgs<UseScopeT extends UseScope.UseScope> = {
    id: string
    description: string
    useScope: UseScopeT
    useCases?: UseCases<UseScopeT>
    subTemplateMap?: Map<string, CmdTemplateType>
}
export class CmdTemplateGroup<UseScopeT extends UseScope.UseScope = UseScope.UseScope> {
    static combineIdSeparator: string = "_"

    public id: string
    public description: string
    public useScope: UseScopeT
    public useCases: UseCases<UseScopeT>
    public subTemplateMap: Map<string, CmdTemplateType>

    constructor(args: CmdTemplateGroupArgs<UseScopeT>) {
        this.id = args.id
        this.description = args.description
        this.useScope = args.useScope
        this.useCases = args.useCases ?? []

        this.subTemplateMap = args.subTemplateMap ?? new Map()
    }


    private addSubTemplateGeneral(subTemplate: CmdTemplateGroup<UseScopeT> | CmdTemplateLeaf<UseScopeT>) {
        this.subTemplateMap.set(subTemplate.id, subTemplate)
    }

    public addSubTemplateGroup(args: Omit<CmdTemplateGroupArgs<UseScopeT>, "useScope">) {
        const subTemplate = new CmdTemplateGroup({ ...args, useScope: this.useScope })
        this.addSubTemplateGeneral(subTemplate)
        return subTemplate
    }
    public addSubTemplateLeaf<Parameters extends Params = Params>(args: Omit<CmdTemplateLeafArgs<UseScopeT, Parameters>, "useScope">) {
        const subTemplate = new CmdTemplateLeaf<UseScopeT, Parameters>({ ...args, useScope: this.useScope })
        this.addSubTemplateGeneral(subTemplate as unknown as CmdTemplateLeaf<UseScopeT>)
        return subTemplate
    }


    public getSubTemplate(id: string) { return this.subTemplateMap.get(id) }


    static subgroupCombine(cmdTemplateGroups: CmdTemplateGroup[]) {
        const defaultCmdTemplateGroup = cmdTemplateGroups[0]

        const combinedSubTemplateMap: Map<string, CmdTemplateGroup | CmdTemplateLeaf> = new Map()
        for (const subTemplateMap of cmdTemplateGroups.map(cmdTemplateGroup => cmdTemplateGroup.subTemplateMap)) {
            for (const [id, cmdTemplateChild] of subTemplateMap.entries()) {
                combinedSubTemplateMap.set(id, cmdTemplateChild)
            }
        }

        return new CmdTemplateGroup({
            id: cmdTemplateGroups.map(cmdTemplateGroup => cmdTemplateGroup.id).join(CmdTemplateGroup.combineIdSeparator),
            description: defaultCmdTemplateGroup.description,
            useScope: defaultCmdTemplateGroup.useScope,
            useCases: cmdTemplateGroups.map(cmdTemplateGroup => cmdTemplateGroup.useCases).flat(1),
            subTemplateMap: combinedSubTemplateMap
        })
    }



    public getBranches() {
        const currentBranches: [...CmdTemplateGroup[], CmdTemplateLeaf][] = []
        for (const subTemplate of this.subTemplateMap.values()) {
            if (subTemplate instanceof CmdTemplateGroup) {
                const subTemplateBranches = subTemplate.getBranches()
                for (const subTemplateBranch of subTemplateBranches) {
                    currentBranches.push([this, ...subTemplateBranch])
                }
            } else {
                currentBranches.push([this, subTemplate])
            }
        }

        return currentBranches
    }


    public createBuilder() {
        const branches = this.getBranches()

        const builderBranches: [...CmdTemplateGroup[], CmdTemplateLeaf][] = []
        for (const branch of branches) {
            if (branch.length >= 1 && branch.length <= 3) {
                builderBranches.push(branch)
            } else if (branch.length > 3) {
                const combinedSubgroup = CmdTemplateGroup.subgroupCombine(branch.slice(1, -1) as CmdTemplateGroup[])
                builderBranches.push([
                    branch[0] as CmdTemplateGroup,
                    combinedSubgroup as CmdTemplateGroup,
                    branch[branch.length - 1] as CmdTemplateLeaf
                ])
            } else {
                throw new Error("Branch length should never be 0.")
            }
        }


        type BuilderTreeThird = { template: CmdTemplateLeaf }

        type BuilderTreeSecondNested = {
            template: CmdTemplateGroup,
            subs: BuilderTreeThird[]
        }
        type BuilderTreeSecond = BuilderTreeSecondNested | BuilderTreeThird

        type BuilderTreeRoot = {
            template: CmdTemplateGroup,
            subs: BuilderTreeSecond[]
        }

        function createBuilderTree(startTemplate: CmdTemplateGroup, builderBranches: [...CmdTemplateGroup[], CmdTemplateLeaf][]) {
            const tree: BuilderTreeRoot = { template: startTemplate, subs: [] as unknown as BuilderTreeRoot["subs"] }

            for (const builderBranch of builderBranches) {
                const cutBranch = builderBranch.slice(1, undefined)
                if (cutBranch.length === 0) {
                    throw new Error("Branch length should never be 0.")
                } else if (cutBranch.length === 1) {
                    tree.subs.push({ template: cutBranch[0] as CmdTemplateLeaf })
                } else {
                    let hasDuplicate = false
                    for (const sub of tree.subs) {
                        if (sub.template instanceof CmdTemplateLeaf) continue
                        if (sub.template.id === cutBranch[0].id) {
                            (sub as BuilderTreeSecondNested).subs.push({ template: cutBranch[1] as CmdTemplateLeaf })
                            hasDuplicate = true
                            break
                        }
                    }
                    if (hasDuplicate) continue

                    tree.subs.push({ template: cutBranch[0] as CmdTemplateGroup, subs: [{ template: cutBranch[1] as CmdTemplateLeaf }] })
                }
            }

            return tree
        }

        const tree = createBuilderTree(this, builderBranches)

        function constructBuilder(tree: BuilderTreeRoot) {
            const builder = new Djs.SlashCommandBuilder()
                .setName(tree.template.id)
                .setDescription(tree.template.description)

            for (const secondTree of tree.subs) {
                if (secondTree.template instanceof CmdTemplateLeaf) {
                    builder.addSubcommand(secondTree.template.setupBuilder.bind(secondTree.template))
                } else {
                    builder.addSubcommandGroup(subcommandGroup => {
                        subcommandGroup
                            .setName(secondTree.template.id)
                            .setDescription(secondTree.template.description)

                        for (const thirdTree of (secondTree as BuilderTreeSecondNested).subs) {
                            subcommandGroup.addSubcommand(thirdTree.template.setupBuilder.bind(thirdTree.template))
                        }

                        return subcommandGroup
                    })
                }
            }

            return builder
        }

        return constructBuilder(tree)
    }


    public getDeployDisplay(tabs: number = 0) {
        let text = "\t".repeat(tabs) + `- ${this.id}`
        for (const template of this.subTemplateMap.values()) {
            text = text.concat("\n" + template.getDeployDisplay(tabs + 1))
        }

        return text
    }
}



type CmdTemplateLeafArgs<UseScopeT extends UseScope.UseScope = UseScope.UseScope, ParamsT extends Params = Params> = {
    id: string
    description: string
    parameters?: ParamsT
    useScope: UseScopeT
    useCases?: UseCases
    executeFunc: ExecuteFunc<UseScopeT, ParamsT>
}
export class CmdTemplateLeaf<UseScopeT extends UseScope.UseScope = UseScope.UseScope, ParamsT extends Params = Params> {
    public id: string
    public description: string
    public parameters: ParamParser.CmdGeneralParameter[] | null
    public useScope: UseScopeT
    public useCases: UseCases
    public executeFunc: ExecuteFunc<UseScopeT, ParamsT>

    constructor(args: CmdTemplateLeafArgs<UseScopeT, ParamsT>) {
        this.id = args.id
        this.description = args.description
        this.parameters = (args.parameters as ParamParser.CmdGeneralParameter[]) ?? (null as ParamsT)
        this.useScope = args.useScope
        this.useCases = args.useCases ?? []
        this.executeFunc = args.executeFunc
    }


    public async runCmd(interaction: UseScope.UseScopeToInteractionMap<UseScopeT>) {
        let args: ParamParser.ParamsToValueMap<NonNullable<ParamsT>> | undefined
        if (this.parameters !== null) {
            args = await ParamParser.getParameterValues(
                interaction, this.parameters
            ) as ParamParser.ParamsToValueMap<NonNullable<ParamsT>>
        } else {
            args = undefined
        }

        return await this.executeFunc(...[interaction, args] as Parameters<ExecuteFunc<UseScopeT, ParamsT>>)
    }


    public setupBuilder<BuilderT extends Djs.SlashCommandBuilder | Djs.SlashCommandSubcommandBuilder>(builder: BuilderT) {
        builder
            .setName(this.id)
            .setDescription(this.description)

        if (this.parameters !== null) {
            for (const parameter of this.parameters) {
                parameter.addOptionToBuilder(builder)
            }
        }

        return builder
    }

    public createBuilder() {
        return this.setupBuilder(new Djs.SlashCommandBuilder())
    }

    public getDeployDisplay(tabs: number = 0) {
        return "\t".repeat(tabs) + `- ${this.id}`
    }
}


export type CmdTemplateType = CmdTemplateGroup | CmdTemplateLeaf