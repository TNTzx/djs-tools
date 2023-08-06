import * as UseScope from "./use_scope"



type ConditionFunc<UseScopeT extends UseScope.UseScope> =
    (interaction: UseScope.UseScopeToInteractionMap<UseScopeT>) => Promise<string | null>


export class UseCase<UseScopeT extends UseScope.UseScope = UseScope.UseScope> {
    public name: string
    public initialUseCases: UseCase<UseScopeT>[]
    public useScope: UseScopeT
    private conditionFunc: ConditionFunc<UseScopeT>

    constructor(
        args: {
            name: string,
            initialUseCases?: UseCase<UseScope.UseScope>[]
            useScope: UseScopeT
            conditionFunc: ConditionFunc<UseScopeT>
        }
    ) {
        this.name = args.name
        this.initialUseCases = (args.initialUseCases as UseCase<UseScopeT>[]) ?? []
        this.useScope = args.useScope
        this.conditionFunc = args.conditionFunc
    }


    public async isMet(interaction: UseScope.UseScopeToInteractionMap<UseScopeT>): Promise<string | null> {
        for (const initialUseCase of this.initialUseCases) {
            const result = await initialUseCase.isMet(interaction)
            if (typeof result === "string") return result
        }

        return await this.conditionFunc(interaction)
    }
}

export const caseServerOwner = new UseCase({
    name: "server owner",
    useScope: UseScope.useScopeGuildOnly,
    conditionFunc: async interaction => {
        if (!(interaction.user.id === interaction.guild.ownerId))
            return "You are not the server owner!"

        return null
    }
})