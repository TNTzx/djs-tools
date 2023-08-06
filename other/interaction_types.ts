import Djs from "discord.js"

export type ChatInputCommandInteractionOptions = Omit<Djs.CommandInteractionOptionResolver<Djs.CacheType>, "getMessage" | "getFocused">