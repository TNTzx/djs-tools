import * as Djs from "discord.js"



export function isDiscordErrorChannelNotFound(error: unknown): error is Djs.DiscordAPIError {
    return error instanceof Djs.DiscordAPIError && error.code === 10003
}

export function isDiscordErrorMessageNotFound(error: unknown): error is Djs.DiscordAPIError {
    return error instanceof Djs.DiscordAPIError && error.code === 10008
}

export function isDiscordErrorForbidden(error: unknown): error is Djs.DiscordAPIError {
    return error instanceof Djs.DiscordAPIError && error.code === 50001
}
