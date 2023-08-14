import * as Djs from "discord.js"

import * as UseScope from "./use_scope"



export interface ReplyOptions extends Djs.BaseMessageOptions {
    tts?: boolean
    // TODO ephemeralIfPossible
}


type Source = UseScope.AllScopedCommandInteraction | Djs.Message
export abstract class Context<SourceT extends Source> {
    public source: SourceT

    constructor(source: SourceT) {
        this.source = source
    }

    public abstract reply(args: string | ReplyOptions): Promise<Djs.Message>
}


type SourceGuild = UseScope.GuildCommandInteraction | Djs.Message<true>
export class ContextGuild<SourceT extends SourceGuild> extends Context<SourceT> {
    public guild: Djs.Guild
    public channel: Djs.GuildTextBasedChannel
    public member: Djs.GuildMember

    constructor(source: SourceT) {
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


type SourceDM = UseScope.DMCommandInteraction | Djs.Message<false>
export class ContextDM<SourceT extends SourceDM> extends Context<SourceT> {
    public user: Djs.User

    constructor(source: SourceT) {
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