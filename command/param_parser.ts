import Djs from "discord.js"

import * as Client from "../client"

import * as Other from "../other"
import * as Context from "./context"



export type ChoiceOption<T extends string | number = string | number> = { name: string, value: T }
export type Choices<T extends string | number = string | number> = readonly ChoiceOption<T>[]

type IsRequiredMap<ValueTypeT, IsRequired extends boolean> = IsRequired extends true ? ValueTypeT : ValueTypeT | null

type Builder = Djs.SlashCommandBuilder | Djs.SlashCommandSubcommandBuilder
type BuilderReturned = Djs.SlashCommandSubcommandBuilder | Djs.SlashCommandOptionsOnlyBuilder

type ValueChecker<ValueTypeT> = ((value: ValueTypeT) => Promise<HErrorParamValueCheck | null>) | null



export interface CmdGeneralParameter<ValueTypeT = unknown, IsRequired extends boolean = boolean> {
    readonly required: IsRequired
    readonly name: string
    readonly description: string

    getValueFromItrOptions: (interactionOptions: Other.ChatInputCommandInteractionOptions) => ValueTypeT | null
    getValueFromItr: (interaction: Djs.ChatInputCommandInteraction) => Promise<IsRequiredMap<ValueTypeT, IsRequired>>

    getValueFromString: (context: Context.ContextGuild | Context.ContextDM, guildinput: string) => Promise<IsRequiredMap<ValueTypeT, IsRequired>>

    addOptionToBuilder: (builder: Builder) => BuilderReturned
}



export class HErrorParamValueCheck extends Other.HandleableError {
    private __nominalHErrorParamValueCheck() {}

    constructor(public herror: Other.HandleableError) {
        super(herror.internalMessage, herror)
    }

    public override getDisplayMessage(): string {
        return this.herror.getDisplayMessage()
    }
}

export class HErrorSingleParam extends Other.HandleableError {
    private __nominalHErrorSingleParam() { }

    constructor(public parameter: CmdGeneralParameter, public externalMessage: string, cause?: Error) {
        super(`${parameter.name}: ${externalMessage}`, cause)
    }

    static fromParamValueCheck(herror: HErrorParamValueCheck, parameter: CmdGeneralParameter) {
        return new HErrorSingleParam(parameter, herror.getDisplayMessage(), herror)
    }

    public getListDisplay() {
        return `${Djs.inlineCode(this.parameter.name)}: ${this.externalMessage}`
    }

    public override getDisplayMessage(): string {
        return `You have given an invalid argument for the parameter ${this.getListDisplay()}`
    }
}

export class HErrorReferredParams extends Other.HandleableError {
    private __nominalHErrorReferredParams() {}

    constructor(public referredParameters: CmdGeneralParameter[], public herror: Other.HandleableError) {
        super(`${referredParameters.map(param => param.name).join(", ")}: ${herror.getDisplayMessage()}`, herror)
    }

    public override getDisplayMessage(): string {
        return Djs.bold(`You have given an invalid argument for the following parameter${this.referredParameters.length > 1 ? "s" : ""}:\n`) +
            Djs.inlineCode(this.referredParameters.map(param => param.name).join(", ")) + ": " +
            this.herror.getDisplayMessage()
    }
}

export class HErrorParams<HErrorSingleParamsT = unknown> extends Other.HandleableError {
    private __nominalHErrorParams() { }

    public herrorSingleParams: HErrorSingleParam[]

    constructor(herrorSingleParams: HErrorSingleParamsT, cause?: Error) {
        const typedHErrorSingleParams = herrorSingleParams as HErrorSingleParam[]
        super(`The following parameters received arguments that are invalid: ${typedHErrorSingleParams.map(herror => herror.parameter.name)}`, cause)

        this.herrorSingleParams = typedHErrorSingleParams
    }

    public getDisplayMessage(): string {
        return Djs.bold("You have given incorrect arguments for these parameters:\n") +
            (this.herrorSingleParams.map(af => af.getListDisplay())).join("\n")
    }
}

type CmdParameterArgs<
    ValueTypeT,
    IsRequired extends boolean,
> = {
    required: IsRequired,
    name: string,
    description: string,
    valueChecker?: ValueChecker<ValueTypeT>
}
export abstract class CmdParameter<
    ValueTypeT = unknown,
    IsRequired extends boolean = boolean,
    BuilderOption extends Djs.ApplicationCommandOptionBase = Djs.ApplicationCommandOptionBase
> implements CmdGeneralParameter<ValueTypeT, IsRequired> {
    public readonly required: IsRequired
    public readonly name: string
    public readonly description: string
    public readonly valueChecker: ValueChecker<ValueTypeT>

    constructor(args: CmdParameterArgs<ValueTypeT, IsRequired>) {
        this.required = args.required
        this.name = args.name
        this.description = args.description
        this.valueChecker = args.valueChecker ?? null
    }


    public toGetValueArgs(): [string, boolean] {
        return [this.name, this.required]
    }

    public abstract getValueFromItrOptions(interactionOptions: Other.ChatInputCommandInteractionOptions): ValueTypeT | null

    public async getValueFromItr(interaction: Djs.ChatInputCommandInteraction): Promise<IsRequiredMap<ValueTypeT, IsRequired>> {
        const value = await this.getValueFromItrOptions(interaction.options)
        if (this.required && value === null) throw new HErrorSingleParam(this, "This argument is required.")

        if (value !== null) {
            const assertResult = await this.assertValue(value)
            if (assertResult !== null) throw assertResult

            // TEST
            if (this.valueChecker !== null) {
                const valueCheckResult = await this.valueChecker(value)
                if (valueCheckResult !== null) throw HErrorSingleParam.fromParamValueCheck(valueCheckResult, this)
            }
        }

        return value as IsRequiredMap<ValueTypeT, IsRequired>
    }


    public abstract getValueFromString(context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<ValueTypeT, IsRequired>>


    public async assertValue(_value: ValueTypeT): Promise<HErrorSingleParam | null> {
        return null
    }


    public setupBuilderOption(option: BuilderOption) {
        option
            .setName(this.name)
            .setDescription(this.description)
            .setRequired(this.required)

        return option
    }

    public abstract addOptionToBuilder(builder: Builder): BuilderReturned
}



export class ErrorInputNotInChoice extends Error {
    private __nominalErrorInputNotInChoice() {}

    constructor(public input: string, choices: Choices, cause?: Error) {
        super(`The input "${input}" is not in the choices: ${choices.map(choice => choice.name).join(", ")}.`, {cause: cause})
    }
}

export class HErrorInputNotInChoice extends HErrorSingleParam {
    private __nominalHErrorInputNotInChoice() {}

    constructor(public parameter: CmdGeneralParameter, public input: string, public choices: Choices, cause?: Error) {
        super(parameter, `The input "${input}" is not in the choices! The choices are: ${choices.map(choice => choice.name).join(", ")}.`, cause)
    }
}


export class ChoiceManager<ChoicesT extends Choices<ValueTypeT>, ValueTypeT extends string | number> {
    constructor(public choices: ChoicesT) { }

    public setupBuilderOption<
        T extends Djs.SlashCommandStringOption
        | Djs.SlashCommandNumberOption
        | Djs.SlashCommandIntegerOption
    >(builderOption: T) {
        if (this.choices === null) return builderOption

        return builderOption.addChoices(
            ...this.choices as unknown as (Djs.APIApplicationCommandOptionChoice<string> & Djs.APIApplicationCommandOptionChoice<number>)[]
        ) as T
    }

    public getValueFromString(input: string): ValueTypeT {
        const choice = this.choices.find(choice => choice.name === input)
        if (choice === undefined) throw new ErrorInputNotInChoice(input, this.choices)
        return choice.value
    }

    public getValueFromStringHandled(parameter: CmdGeneralParameter, input: string) {
        try {
            return this.getValueFromString(input)
        } catch (error) {
            if (error instanceof ErrorInputNotInChoice) throw new HErrorInputNotInChoice(parameter, input, this.choices, error)
            throw error
        }
    }
}
interface HasChoices<ChoicesT extends Choices<ValueTypeT>, ValueTypeT extends string | number> {
    choiceManager: ChoiceManager<ChoicesT, ValueTypeT> | null
}
interface ChoiceManagerMixinArgs<ChoicesT extends Choices<ValueTypeT>, ValueTypeT extends string | number> {
    choiceManager?: ChoiceManager<ChoicesT, ValueTypeT>
}



export class CmdParamString<
    IsRequired extends boolean = boolean,
    ChoicesT extends Choices<string> = Choices<string>
>
    extends CmdParameter<string, IsRequired, Djs.SlashCommandStringOption>
    implements HasChoices<ChoicesT, string>
{
    private __nominalString() { }

    public choiceManager: ChoiceManager<ChoicesT, string> | null

    constructor(args: CmdParameterArgs<string, IsRequired> & ChoiceManagerMixinArgs<ChoicesT, string>) {
        super(args)
        this.choiceManager = args.choiceManager ?? null
    }

    public min_chars: number = 1
    public max_chars: number = 2000

    public setLengthLimits(min?: number, max?: number) {
        this.min_chars = min ?? this.min_chars
        this.max_chars = max ?? this.max_chars
        return this
    }


    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getString(...this.toGetValueArgs())
    }

    public override async getValueFromString(_context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<string, IsRequired>> {
        if (this.choiceManager !== null) {
            // TEST
            return this.choiceManager.getValueFromStringHandled(this, input)
        }
        if (input.length > this.max_chars) {
            // TEST
            throw new HErrorSingleParam(
                this,
                "The length of the input is too long! " +
                `Maximum length is ${this.max_chars}, your input is ${input.length} characters long.`
            )
        }
        if (input.length < this.min_chars) {
            // TEST
            throw new HErrorSingleParam(
                this,
                "The length of the input is too short! " +
                `Minimum length is ${this.min_chars}, your input is ${input.length} characters long.`
            )
        }

        return input
    }


    public override setupBuilderOption(option: Djs.SlashCommandStringOption): Djs.SlashCommandStringOption {
        const builder = super.setupBuilderOption(option)
            .setMaxLength(this.max_chars)
            .setMinLength(this.min_chars)
        if (this.choiceManager !== null) {
            return this.choiceManager.setupBuilderOption(builder)
        } else {
            return builder
        }
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addStringOption(this.setupBuilderOption.bind(this))
    }
}



class ErrorNumberTooSmall extends Error {
    private __nominalErrorNumberTooSmall() {}

    constructor(public input: number, public minValue: number, cause?: Error) {
        super(`Input ${input} is too small, minimum is ${minValue}.`, {cause: cause})
    }
}

class ErrorNumberTooBig extends Error {
    private __nominalErrorErrorNumberTooBig() {}

    constructor(public input: number, public maxValue: number, cause?: Error) {
        super(`Input ${input} is too big, maximum is ${maxValue}.`, {cause: cause})
    }
}


class HErrorNumberTooSmall extends HErrorSingleParam {
    private __nominalHErrorNumberTooSmall() {}

    constructor(public parameter: CmdGeneralParameter, public input: number, public minValue: number, cause?: Error) {
        super(parameter, `Your input is too small! The minimum is ${minValue}, your input was ${input}!`, cause)
    }
}

class HErrorNumberTooBig extends HErrorSingleParam {
    private __nominalHErrorNumberTooBig() {}

    constructor(public parameter: CmdGeneralParameter, public input: number, public maxValue: number, cause?: Error) {
        super(parameter, `Your input is too big! The maximum is ${maxValue}, your input was ${input}!`, cause)
    }
}


class BoundedNumberHandler {
    constructor(public minValue: number | null = null, public maxValue: number | null = null) {}

    public validateNumber(input: number) {
        if (this.minValue !== null) {
            // TEST
            if (input < this.minValue) return new ErrorNumberTooSmall(input, this.minValue)
        }
        if (this.maxValue !== null) {
            // TEST
            if (input > this.maxValue) return new ErrorNumberTooBig(input, this.maxValue)
        }
        return null
    }

    public validateNumberHandled(parameter: CmdGeneralParameter, input: number) {
        const result = this.validateNumber(input)
        if (result instanceof ErrorNumberTooBig) throw new HErrorNumberTooBig(parameter, result.input, result.maxValue, result)
        if (result instanceof ErrorNumberTooSmall) throw new HErrorNumberTooSmall(parameter, result.input, result.minValue, result)
        return null
    }
}
interface HasBoundHandler extends CmdGeneralParameter {
    boundedNumberHandler: BoundedNumberHandler | null
}
interface BoundHandlerMixinArgs {
    boundedNumberHandler?: BoundedNumberHandler | null
}


interface ParamNumeric<ChoicesT extends Choices<number>> extends HasBoundHandler, HasChoices<ChoicesT, number> {}

interface ParamNumericMixinArgs<ChoicesT extends Choices<number>> extends ChoiceManagerMixinArgs<ChoicesT, number>, BoundHandlerMixinArgs {}

function setupBuilderOptionNumeric<
    BuilderOption extends Djs.SlashCommandIntegerOption | Djs.SlashCommandNumberOption,
    ChoicesT extends Choices<number>
>(parameter: ParamNumeric<ChoicesT>, builder: BuilderOption): BuilderOption {
    if (parameter.boundedNumberHandler !== null) {
        // TEST
        const bnh = parameter.boundedNumberHandler
        if (bnh.maxValue !== null) builder.setMaxValue(bnh.maxValue)
        if (bnh.minValue !== null) builder.setMinValue(bnh.minValue)
    }

    if (parameter.choiceManager !== null) {
        return parameter.choiceManager.setupBuilderOption(builder)
    } else {
        return builder
    }
}



class HErrorNaN extends HErrorSingleParam {
    private __nominalHErrorNaN() {}

    constructor(public parameter: CmdGeneralParameter, public input: string, public type: "integer" | "number", cause?: Error) {
        super(parameter, `The input "${input}" is not ${type === "integer" ? "an integer" : "a number"}!`, cause)
    }
}



export class CmdParamInteger<
    IsRequired extends boolean = boolean,
    ChoicesT extends Choices<number> = Choices<number>
> extends CmdParameter<number, IsRequired, Djs.SlashCommandIntegerOption> implements ParamNumeric<ChoicesT> {
    private __nominalInt() { }

    public choiceManager: ChoiceManager<ChoicesT, number> | null
    public boundedNumberHandler: BoundedNumberHandler | null

    constructor(args: CmdParameterArgs<number, IsRequired> & ParamNumericMixinArgs<ChoicesT>) {
        super(args)
        this.choiceManager = args.choiceManager ?? null
        this.boundedNumberHandler = args.boundedNumberHandler ?? null
    }

    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getInteger(...this.toGetValueArgs())
    }

    public override async getValueFromString(_context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<number, IsRequired>> {
        // TEST not number
        // TEST float
        const inputNumber = parseInt(input)
        if (Number.isNaN(inputNumber)) throw new HErrorNaN(this, input, "integer")
        this.boundedNumberHandler?.validateNumberHandled(this, inputNumber)
        if (this.choiceManager !== null) {
            return this.choiceManager.getValueFromStringHandled(this, input)
        } else {
            return inputNumber
        }
    }


    public override setupBuilderOption(option: Djs.SlashCommandIntegerOption): Djs.SlashCommandIntegerOption {
        return setupBuilderOptionNumeric(this, super.setupBuilderOption(option))
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addIntegerOption(this.setupBuilderOption.bind(this))
    }
}

export class CmdParamNumber<
    IsRequired extends boolean = boolean,
    ChoicesT extends Choices<number> = Choices<number>
> extends CmdParameter<number, IsRequired, Djs.SlashCommandNumberOption> implements ParamNumeric<ChoicesT> {
    private __nominalNumber() { }

    public choiceManager: ChoiceManager<ChoicesT, number> | null
    public boundedNumberHandler: BoundedNumberHandler | null

    constructor(args: CmdParameterArgs<number, IsRequired> & ParamNumericMixinArgs<ChoicesT>) {
        super(args)
        this.choiceManager = args.choiceManager ?? null
        this.boundedNumberHandler = args.boundedNumberHandler ?? null
    }


    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getNumber(...this.toGetValueArgs())
    }

    public override async getValueFromString(_context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<number, IsRequired>> {
        // TEST not number
        const inputNumber = parseFloat(input)
        if (Number.isNaN(inputNumber)) throw new HErrorNaN(this, input, "number")
        this.boundedNumberHandler?.validateNumberHandled(this, inputNumber)
        if (this.choiceManager !== null) {
            return this.choiceManager.getValueFromStringHandled(this, input)
        } else {
            return inputNumber
        }
    }

    public override setupBuilderOption(option: Djs.SlashCommandNumberOption): Djs.SlashCommandNumberOption {
        return setupBuilderOptionNumeric(this, super.setupBuilderOption(option))
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addNumberOption(this.setupBuilderOption.bind(this))
    }
}


export class CmdParamBoolean<
    IsRequired extends boolean = boolean,
> extends CmdParameter<boolean, IsRequired, Djs.SlashCommandBooleanOption> {
    private __nominalBoolean() { }

    static validTrueStrings = ["true", "1", "yes"]
    static validFalseStrings = ["false", "0", "no"]

    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getBoolean(...this.toGetValueArgs())
    }

    public override async getValueFromString(_context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<boolean, IsRequired>> {
        input = input.toLowerCase()
        if (CmdParamBoolean.validTrueStrings.includes(input)) return true
        if (CmdParamBoolean.validFalseStrings.includes(input)) return false

        throw new HErrorSingleParam(
            this,
            `The input ${Djs.inlineCode(input)} is not a valid boolean! ` +
            `Input a true value using ${Djs.inlineCode(CmdParamBoolean.validTrueStrings.join(", "))} or ` +
            `input a false value using ${Djs.inlineCode(CmdParamBoolean.validFalseStrings.join(", "))}!`
        )
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addBooleanOption(this.setupBuilderOption.bind(this))
    }
}



function isSnowflakeHError(parameter: CmdGeneralParameter, input: string) {
    // TEST
    const idTest = parseInt(input)
    if (Number.isNaN(idTest)) throw new HErrorSingleParam(parameter, "The input is not an ID.")
}


export type CmdParamMentionableValue = NonNullable<ReturnType<Other.ChatInputCommandInteractionOptions["getMentionable"]>>
export class CmdParamMentionable<
    IsRequired extends boolean = boolean,
> extends CmdParameter<CmdParamMentionableValue, IsRequired, Djs.SlashCommandMentionableOption> {
    private __nominalMentionable() { }

    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getMentionable(...this.toGetValueArgs())
    }

    public override async getValueFromString(context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<CmdParamMentionableValue, IsRequired>> {
        isSnowflakeHError(this, input)

        // TEST
        if (context instanceof Context.ContextDM) throw new HErrorSingleParam(this, "You can't use this command in DMs.")

        const roleResult = await context.guild.roles.fetch(input, {force: true})
        if (roleResult !== null) return roleResult

        const memberResult = await context.guild.members.fetch({user: input, force: true})
        if (memberResult !== null) return memberResult

        // TEST
        throw new HErrorSingleParam(this, "The ID is not a role or member.")
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addMentionableOption(this.setupBuilderOption.bind(this))
    }
}


export interface CmdParamChannelGeneral<
    ChannelRestrictsT extends (readonly ChannelRestrict[]) | null = (readonly ChannelRestrict[]) | null,
    ValueTypeT = unknown,
    IsRequired extends boolean = boolean
> extends CmdParameter<ValueTypeT, IsRequired, Djs.SlashCommandChannelOption> {
    validChannelTypes: ChannelRestrictsT
}

export type CmdParamChannelValue = NonNullable<ReturnType<Other.ChatInputCommandInteractionOptions["getChannel"]>>

export enum ChannelRestrict {
    GuildText = Djs.ChannelType.GuildText,
    DM = Djs.ChannelType.DM,
    GuildVoice = Djs.ChannelType.GuildVoice,
    GroupDM = Djs.ChannelType.GroupDM,
    GuildCategory = Djs.ChannelType.GuildCategory,
    GuildAnnouncement = Djs.ChannelType.GuildAnnouncement,
    AnnouncementThread = Djs.ChannelType.AnnouncementThread,
    PublicThread = Djs.ChannelType.PublicThread,
    PrivateThread = Djs.ChannelType.PrivateThread,
    GuildStageVoice = Djs.ChannelType.GuildStageVoice,
    GuildDirectory = Djs.ChannelType.GuildDirectory,
    GuildForum = Djs.ChannelType.GuildForum,
    GuildMedia = Djs.ChannelType.GuildMedia
}

type ChannelRestrictsMap<ValidChannelTypes extends readonly ChannelRestrict[]> = (
    { [P in keyof ValidChannelTypes]: ChannelEnumToRestrictMap<ValidChannelTypes[P]> }[number]
)
type ChannelRestrictsOptionalMap<ValidChannelTypes extends (readonly ChannelRestrict[]) | null> = (
    ValidChannelTypes extends readonly ChannelRestrict[]
    ? ChannelRestrictsMap<ValidChannelTypes>
    : CmdParamChannelValue
)
type ChannelEnumToRestrictMap<ChannelType extends ChannelRestrict> = (
    ChannelType extends ChannelRestrict.GuildText ? Djs.TextChannel :
    ChannelType extends ChannelRestrict.DM ? Djs.DMChannel :
    ChannelType extends ChannelRestrict.GuildVoice ? Djs.VoiceChannel :
    ChannelType extends ChannelRestrict.GroupDM ? Djs.PartialGroupDMChannel :
    ChannelType extends ChannelRestrict.GuildCategory ? Djs.CategoryChannel :
    ChannelType extends ChannelRestrict.GuildAnnouncement ? Djs.TextChannel :
    ChannelType extends ChannelRestrict.AnnouncementThread ? Djs.ThreadChannel :
    ChannelType extends ChannelRestrict.PublicThread ? Djs.ThreadChannel :
    ChannelType extends ChannelRestrict.PrivateThread ? Djs.ThreadChannel :
    ChannelType extends ChannelRestrict.GuildStageVoice ? Djs.StageChannel :
    ChannelType extends ChannelRestrict.GuildDirectory ? Djs.DirectoryChannel :
    ChannelType extends ChannelRestrict.GuildForum ? Djs.ForumChannel :
    ChannelType extends ChannelRestrict.GuildMedia ? Djs.MediaChannel :
    never
)
const channelEnumToStringMap = {
    [ChannelRestrict.GuildText]: "text",
    [ChannelRestrict.DM]: "dm",
    [ChannelRestrict.GuildVoice]: "voice",
    [ChannelRestrict.GroupDM]: "group-dm",
    [ChannelRestrict.GuildCategory]: "category",
    [ChannelRestrict.GuildAnnouncement]: "announcement",
    [ChannelRestrict.AnnouncementThread]: "announcement-thread",
    [ChannelRestrict.PublicThread]: "public-thread",
    [ChannelRestrict.PrivateThread]: "private-thread",
    [ChannelRestrict.GuildStageVoice]: "stage",
    [ChannelRestrict.GuildDirectory]: "directory",
    [ChannelRestrict.GuildForum]: "forum",
    [ChannelRestrict.GuildMedia]: "media",
}
export class CmdParamChannel<
    ChannelRestrictsT extends (readonly ChannelRestrict[]) | null = (readonly ChannelRestrict[]) | null,
    ValueTypeT extends ChannelRestrictsOptionalMap<ChannelRestrictsT> = ChannelRestrictsOptionalMap<ChannelRestrictsT>,
    IsRequired extends boolean = boolean,
>
    extends CmdParameter<ValueTypeT, IsRequired, Djs.SlashCommandChannelOption>
    implements CmdParamChannelGeneral<ChannelRestrictsT, ValueTypeT, IsRequired>
{
    private __nominalChannel() { }

    public validChannelTypes: ChannelRestrictsT

    constructor(args: CmdParameterArgs<ValueTypeT, IsRequired> & { readonly validChannelTypes?: ChannelRestrictsT }) {
        super(args)
        this.validChannelTypes = args.validChannelTypes ?? null as unknown as ChannelRestrictsT
    }

    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getChannel(...this.toGetValueArgs()) as ValueTypeT
    }

    public override async getValueFromString(context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<ValueTypeT, IsRequired>> {
        isSnowflakeHError(this, input)

        if (context instanceof Context.ContextDM) throw new HErrorSingleParam(this, "You can't use this command in DMs.")

        // TEST
        const result = await context.guild.channels.fetch(input, {force: true})
        if (result === null) throw new HErrorSingleParam(this, "The input is not a channel.")

        // TODO got burned out maybe tomorrow

        if (this.validChannelTypes !== null) {
            if (result !== null && !(this.validChannelTypes.includes(result.type as unknown as ChannelRestrict))) {
                throw new HErrorSingleParam(this,
                    "The channel is not within the valid channel types. Valid channel types are: `" +
                    this.validChannelTypes.map(x => channelEnumToStringMap[x]).join("`, `") +
                    "`"
                )
            }
        }

        return result as IsRequiredMap<ValueTypeT, IsRequired>
    }

    public override async assertValue(value: ValueTypeT): Promise<HErrorSingleParam | null> {
        if (this.validChannelTypes === null) return null
        if (this.validChannelTypes.includes(value.type as number)) return null

        return new HErrorSingleParam(
            this,
            "The channel is not a channel of the correct type. " + (
                this.validChannelTypes.length === 1
                    ? `You must input a ${channelEnumToStringMap[this.validChannelTypes[0]]} channel.`
                    : `You must input a channel of one of these types: ${
                        this.validChannelTypes.map(validChannelType => channelEnumToStringMap[validChannelType] + "channel").join(", ")
                    }`
            )
        )
    }


    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addChannelOption(this.setupBuilderOption.bind(this))
    }
}

export type CmdParamRoleValue = Djs.Role | Djs.APIRole
export class CmdParamRole<
    IsRequired extends boolean = boolean,
> extends CmdParameter<CmdParamRoleValue, IsRequired, Djs.SlashCommandRoleOption> {
    private __nominalRole() { }

    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getRole(...this.toGetValueArgs())
    }

    public override async getValueFromString(context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<CmdParamRoleValue, IsRequired>> {
        if (context instanceof Context.ContextDM) throw new HErrorSingleParam(this, "You can't use this command in DMs.")

        const roleResult = await context.guild.roles.fetch(input, {force: true})
        if (roleResult === null) throw new HErrorSingleParam(this, "The ID is not a role.")

        return roleResult
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addRoleOption(this.setupBuilderOption.bind(this))
    }
}

export type CmdParamUserValue = Djs.User
export class CmdParamUser<
    IsRequired extends boolean = boolean,
> extends CmdParameter<CmdParamUserValue, IsRequired, Djs.SlashCommandUserOption> {
    private __nominalUser() { }

    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getUser(...this.toGetValueArgs())
    }

    public override async getValueFromString(context: Context.ContextGuild | Context.ContextDM, input: string): Promise<IsRequiredMap<CmdParamUserValue, IsRequired>> {
        const userResult = await Client.getBotClient().users.fetch(input, {force: true})
        if (userResult === null) throw new HErrorSingleParam(this, "The ID is not a user.")

        return userResult
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addUserOption(this.setupBuilderOption.bind(this))
    }
}

export type CmdParamAttachmentValue = Djs.Attachment
export class CmdParamAttachment<
    IsRequired extends boolean = boolean,
> extends CmdParameter<CmdParamAttachmentValue, IsRequired, Djs.SlashCommandAttachmentOption> {
    private __nominalAttachment() { }

    public override getValueFromItrOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getAttachment(...this.toGetValueArgs())
    }

    public getValueFromString(_context: Context.ContextGuild | Context.ContextDM, _input: string): Promise<IsRequiredMap<Djs.Attachment, IsRequired>> {
        throw new Error("Method not implemented.")
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addAttachmentOption(this.setupBuilderOption.bind(this))
    }
}



export function createGenericChoice<ChoiceType extends string | number>(nameValue: ChoiceType): ChoiceOption<ChoiceType> {
    return {
        name: nameValue.toString(),
        value: nameValue
    }
}



type ParamsWithChoices = CmdParamString | CmdParamInteger | CmdParamNumber

type InferChoices<ParamWithChoice extends ParamsWithChoices> = (
    ParamWithChoice extends CmdParamString<boolean, infer ChoicesT> ? ChoicesT
    : ParamWithChoice extends CmdParamInteger<boolean, infer ChoicesT> ? ChoicesT
    : ParamWithChoice extends CmdParamNumber<boolean, infer ChoicesT> ? ChoicesT
    : null
)


type ValueOrChoiceMap<ValueTypeT, ChoicesT extends Choices<string | number>> = (
    ChoicesT extends null ? ValueTypeT : NonNullable<ChoicesT>[number]["value"]
)



export type ParamsToValueMap<CmdParameters> = {
    [P in keyof CmdParameters]:
    CmdParameters[P] extends CmdParameter<
        infer ValueTypeT,
        infer IsRequired
    > ? (
        CmdParameters[P] extends ParamsWithChoices
        ? IsRequiredMap<ValueOrChoiceMap<ValueTypeT, InferChoices<CmdParameters[P]>>, IsRequired>
        : IsRequiredMap<ValueTypeT, IsRequired>
    ) : never
}

export async function getParameterValues<
    Parameters extends readonly CmdGeneralParameter[],
>(
    interaction: Djs.ChatInputCommandInteraction,
    parameters: Parameters,
): Promise<ParamsToValueMap<Parameters>> {
    const results = []
    const errors: HErrorSingleParam[] = []
    for (const parameter of parameters) {
        try {
            results.push(await parameter.getValueFromItr(interaction))
        } catch (error) {
            if (error instanceof HErrorSingleParam) {
                errors.push(error)
            } else {
                throw error
            }
        }
    }

    if (errors.length > 0) {
        throw new HErrorParams(errors)
    }

    return results as ParamsToValueMap<Parameters>
}