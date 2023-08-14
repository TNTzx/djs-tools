import Djs from "discord.js"



export type UseScope<IsGuildUsable extends boolean = boolean, IsDmsUsable extends boolean = boolean> = {
    isGuildUsable: IsGuildUsable
    isDmsUsable: IsDmsUsable
}

export const useScopeAll: UseScope<true, true> = {isGuildUsable: true, isDmsUsable: true}
export const useScopeGuildOnly: UseScope<true, false> = {isGuildUsable: true, isDmsUsable: false}
export const useScopeDMsOnly: UseScope<false, true> = {isGuildUsable: false, isDmsUsable: true}



export interface GuildCommandInteraction extends Djs.ChatInputCommandInteraction {
    guild: Djs.Guild
    guildId: string
    channel: Djs.GuildTextBasedChannel
    member: Djs.GuildMember
}

export interface DMCommandInteraction extends Djs.ChatInputCommandInteraction {
    guild: null
    guildId: null
    member: null
}

export type AllScopedCommandInteraction = Djs.ChatInputCommandInteraction | GuildCommandInteraction | DMCommandInteraction

export type MergeScopeCommandInteraction = Djs.ChatInputCommandInteraction & GuildCommandInteraction & DMCommandInteraction

export type UseScopeToInteractionMap<UseScopeT extends UseScope<boolean, boolean>> = (
    UseScopeT extends UseScope<true, true>
    ? Djs.ChatInputCommandInteraction

    : UseScopeT extends UseScope<true, false>
    ? GuildCommandInteraction

    : UseScopeT extends UseScope<false, true>
    ? DMCommandInteraction

    : AllScopedCommandInteraction
)