import * as Djs from "discord.js"

import * as Other from "../other"
import * as UseScope from "./use_scope"



type ConditionFunc<UseScopeT extends UseScope.UseScope> =
    (interaction: UseScope.UseScopeToInteractionMap<UseScopeT>) => Promise<Other.HandleableError | null>


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


    public async isMet(interaction: UseScope.UseScopeToInteractionMap<UseScopeT>): Promise<Other.HandleableError | null> {
        for (const initialUseCase of this.initialUseCases) {
            const result = await initialUseCase.isMet(interaction)
            if (result !== null) return result
        }

        return await this.conditionFunc(interaction)
    }
}



export class HErrorNotServerOwner extends Other.HandleableError {
    private __nominalHErrorNotServerOwner() {}

    constructor(public user: Djs.User, public guild: Djs.Guild, cause?: Error) {
        super(`UserSID ${user.id} is not the guild owner of GuildSID ${guild.id}.`, cause)
    }

    public override getDisplayMessage(): string {
        return "You are not the server owner for this guild!"
    }
}

export const caseServerOwner = new UseCase({
    name: "server owner",
    useScope: UseScope.useScopeGuildOnly,
    conditionFunc: async interaction => {
        if (!(interaction.user.id === interaction.guild.ownerId))
            return new HErrorNotServerOwner(interaction.user, interaction.guild)

        return null
    }
})