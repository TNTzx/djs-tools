import * as Djs from "discord.js"

import * as UseScope from "./use_scope"



export interface ReplyOptions extends Djs.BaseMessageOptions {
    tts?: boolean
    // TODO ephemeralIfPossible
}


type ContextGeneralSource = UseScope.AllScopedCommandInteraction | Djs.Message
export abstract class Context<SourceT extends ContextGeneralSource = ContextGeneralSource, InGuild extends boolean = boolean> {
    public source: SourceT

    constructor(source: SourceT) {
        this.source = source
    }

    public isSourceMessage(): this is this & {source: Djs.Message<InGuild>} {
        return this.source instanceof Djs.Message
    }

    public abstract reply(args: string | ReplyOptions): Promise<Djs.Message>
}


type ContextGuildSource = UseScope.GuildCommandInteraction | Djs.Message<true>
export class ContextGuild extends Context<ContextGuildSource, true> {
    public guild: Djs.Guild
    public channel: Djs.GuildTextBasedChannel
    public member: Djs.GuildMember

    constructor(source: ContextGuildSource) {
        super(source)

        this.guild = source.guild
        this.channel = source.channel

        if (source.member === null) throw new Error("Member is null.")
        this.member = source.member
    }

    public override async reply(args: string | ReplyOptions) {
        if (this.source instanceof Djs.ChatInputCommandInteraction) {
            return await this.source.followUp(args)
        } else {
            // TODO reply chain
            return await this.source.channel.send(args)
        }
    }
}


type ContextDMSource = UseScope.DMCommandInteraction | Djs.Message<false>
export class ContextDM extends Context<ContextDMSource, true> {
    public user: Djs.User

    constructor(source: ContextDMSource) {
        super(source)

        if (source instanceof Djs.ChatInputCommandInteraction) {
            this.user = source.user
        } else if (source instanceof Djs.Message) {
            this.user = source.author
        } else {
            throw new Error("Invalid source.")
        }
    }

    public override async reply(args: string | ReplyOptions) {
        if (this.source instanceof Djs.ChatInputCommandInteraction) {
            return await this.source.followUp(args)
        } else {
            // TODO reply chain
            return await this.user.send(args)
        }
    }
}