import Djs from "discord.js"

import * as UseScope from "./use_scope"
import * as Other from "../other"



export type ChoiceOption<T extends string | number = string | number> = { name: string, value: T }
export type Choices<T extends string | number = string | number> = readonly ChoiceOption<T>[]

type IsRequiredMap<ValueTypeT, IsRequired extends boolean> = IsRequired extends true ? ValueTypeT : ValueTypeT | null

type Builder = Djs.SlashCommandBuilder | Djs.SlashCommandSubcommandBuilder
type BuilderReturned = Djs.SlashCommandSubcommandBuilder | Omit<Djs.SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">

type ValueChecker<ValueTypeT> = ((value: ValueTypeT) => Promise<HErrorParamValueCheck | null>) | null


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
> {
    public required: IsRequired
    public name: string
    public description: string
    public valueChecker: ValueChecker<ValueTypeT>

    constructor(args: CmdParameterArgs<ValueTypeT, IsRequired>) {
        this.required = args.required
        this.name = args.name
        this.description = args.description
        this.valueChecker = args.valueChecker ?? null
    }


    public toGetValueArgs(): [string, boolean] {
        return [this.name, this.required]
    }

    protected abstract getValueFromInteractionOptions(interactionOptions: Other.ChatInputCommandInteractionOptions): ValueTypeT | null

    public async getValue(interactionOptions: Other.ChatInputCommandInteractionOptions): Promise<IsRequiredMap<ValueTypeT, IsRequired>> {
        const value = await this.getValueFromInteractionOptions(interactionOptions)
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



export class ChoiceManager<ChoicesT extends Choices> {
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
}
interface HasChoices<ChoicesT extends Choices> {
    choiceManager: ChoiceManager<ChoicesT> | null
}
interface ChoiceManagerMixinArgs<ChoicesT extends Choices> {
    choiceManager?: ChoiceManager<ChoicesT>
}



export class CmdParamString<
    IsRequired extends boolean = boolean,
    ChoicesT extends Choices<string> = Choices<string>
>
    extends CmdParameter<string, IsRequired, Djs.SlashCommandStringOption>
    implements HasChoices<ChoicesT>
{
    private __nominalString() { }

    public choiceManager: ChoiceManager<ChoicesT> | null

    constructor(args: CmdParameterArgs<string, IsRequired> & ChoiceManagerMixinArgs<ChoicesT>) {
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

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getString(...this.toGetValueArgs())
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


interface ParamNumeric<ChoicesT extends Choices> extends HasChoices<ChoicesT> {
    min_value: number | null
    max_value: number | null
    setSizeLimits: (min: number | null, max: number | null) => this
}

function setSizeLimitsNumeric(paramNumeric: ParamNumeric<Choices>, min: number | null, max: number | null) {
    paramNumeric.min_value = min
    paramNumeric.max_value = max
}

function setupBuilderOptionNumeric<
    BuilderOption extends Djs.SlashCommandIntegerOption | Djs.SlashCommandNumberOption,
    ChoicesT extends Choices<number>
>(parameter: ParamNumeric<ChoicesT>, builder: BuilderOption): BuilderOption {
    if (parameter.max_value !== null) builder.setMaxValue(parameter.max_value)
    if (parameter.min_value !== null) builder.setMinValue(parameter.min_value)

    if (parameter.choiceManager !== null) {
        return parameter.choiceManager.setupBuilderOption(builder)
    } else {
        return builder
    }
}

export class CmdParamInteger<
    IsRequired extends boolean = boolean,
    ChoicesT extends Choices<number> = Choices<number>
> extends CmdParameter<number, IsRequired, Djs.SlashCommandIntegerOption> implements ParamNumeric<ChoicesT> {
    private __nominalInt() { }

    public choiceManager: ChoiceManager<ChoicesT> | null
    public min_value: number | null = null
    public max_value: number | null = null

    constructor(args: CmdParameterArgs<number, IsRequired> & ChoiceManagerMixinArgs<ChoicesT>) {
        super(args)
        this.choiceManager = args.choiceManager ?? null
    }

    public setSizeLimits(min: number | null, max: number | null) {
        setSizeLimitsNumeric(this, min, max)
        return this
    }

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getInteger(...this.toGetValueArgs())
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

    public choiceManager: ChoiceManager<ChoicesT> | null
    public min_value: number | null = null
    public max_value: number | null = null

    constructor(args: CmdParameterArgs<number, IsRequired> & ChoiceManagerMixinArgs<ChoicesT>) {
        super(args)
        this.choiceManager = args.choiceManager ?? null
    }

    public setSizeLimits(min: number | null, max: number | null) {
        this.min_value = min
        this.max_value = max
        return this
    }

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getNumber(...this.toGetValueArgs())
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

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getBoolean(...this.toGetValueArgs())
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addBooleanOption(this.setupBuilderOption.bind(this))
    }
}


export type CmdParamMentionableValue = NonNullable<ReturnType<Other.ChatInputCommandInteractionOptions["getMentionable"]>>
export class CmdParamMentionable<
    IsRequired extends boolean = boolean,
> extends CmdParameter<CmdParamMentionableValue, IsRequired, Djs.SlashCommandMentionableOption> {
    private __nominalMentionable() { }

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getMentionable(...this.toGetValueArgs())
    }

    public override addOptionToBuilder(builder: Builder): BuilderReturned {
        return builder.addMentionableOption(this.setupBuilderOption.bind(this))
    }
}

export type CmdParamChannelValue = NonNullable<ReturnType<Other.ChatInputCommandInteractionOptions["getChannel"]>>

export enum ChannelRestrict {
    Text = Djs.ChannelType.GuildText,
    DM = Djs.ChannelType.DM,
    Voice = Djs.ChannelType.GuildVoice,
    Category = Djs.ChannelType.GuildCategory,
    PublicThread = Djs.ChannelType.PublicThread,
    PrivateThread = Djs.ChannelType.PrivateThread,
    Stage = Djs.ChannelType.GuildStageVoice,
    Forum = Djs.ChannelType.GuildForum
}

type ChannelRestrictsMap<ValidChannelTypes extends ChannelRestrict[]> = (
    { [P in keyof ValidChannelTypes]: ChannelEnumToRestrictMap<ValidChannelTypes[P]> }[number]
)
type ChannelRestrictsOptionalMap<ValidChannelTypes extends ChannelRestrict[] | null> = (
    ValidChannelTypes extends ChannelRestrict[]
    ? ChannelRestrictsMap<ValidChannelTypes>
    : CmdParamChannelValue
)
type ChannelEnumToRestrictMap<ChannelType extends ChannelRestrict> = (
    ChannelType extends ChannelRestrict.Text ? Djs.TextChannel :
    ChannelType extends ChannelRestrict.DM ? Djs.DMChannel :
    ChannelType extends ChannelRestrict.Voice ? Djs.VoiceChannel :
    ChannelType extends ChannelRestrict.Category ? Djs.CategoryChannel :
    ChannelType extends ChannelRestrict.PublicThread ? Djs.PublicThreadChannel<boolean> :
    ChannelType extends ChannelRestrict.PrivateThread ? Djs.PrivateThreadChannel :
    ChannelType extends ChannelRestrict.Stage ? Djs.StageChannel :
    ChannelType extends ChannelRestrict.Forum ? Djs.ForumChannel :
    never
)
const channelEnumToStringMap = {
    [ChannelRestrict.Text]: "text",
    [ChannelRestrict.DM]: "DM",
    [ChannelRestrict.Voice]: "voice",
    [ChannelRestrict.Category]: "category",
    [ChannelRestrict.PublicThread]: "public thread",
    [ChannelRestrict.PrivateThread]: "private thread",
    [ChannelRestrict.Stage]: "stage",
    [ChannelRestrict.Forum]: "forum"
}
export class CmdParamChannel<
    ChannelRestrictsT extends ChannelRestrict[] | null = ChannelRestrict[] | null,
    ValueTypeT extends ChannelRestrictsOptionalMap<ChannelRestrictsT> = ChannelRestrictsOptionalMap<ChannelRestrictsT>,
    IsRequired extends boolean = boolean,
> extends CmdParameter<ValueTypeT, IsRequired, Djs.SlashCommandChannelOption> {
    private __nominalChannel() { }

    public validChannelTypes: ChannelRestrictsT

    constructor(args: CmdParameterArgs<ValueTypeT, IsRequired> & { validChannelTypes?: ChannelRestrictsT }) {
        super(args)
        this.validChannelTypes = args.validChannelTypes ?? null as unknown as ChannelRestrictsT
    }

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getChannel(...this.toGetValueArgs()) as ValueTypeT
    }

    public override async assertValue(value: ValueTypeT): Promise<HErrorSingleParam | null> {
        if (this.validChannelTypes === null) return null
        if (this.validChannelTypes.includes(value.type as number)) return null

        // TEST
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

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getRole(...this.toGetValueArgs())
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

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getUser(...this.toGetValueArgs())
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

    protected override getValueFromInteractionOptions(options: Other.ChatInputCommandInteractionOptions) {
        return options.getAttachment(...this.toGetValueArgs())
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


export type CmdGeneralParameter = (
    CmdParameter
    | CmdParamString | CmdParamInteger | CmdParamNumber | CmdParamBoolean
    | CmdParamMentionable | CmdParamChannel | CmdParamRole | CmdParamUser | CmdParamAttachment
)



export class HErrorParamValueCheck extends Other.HandleableError {
    private __nominalHErrorParamValueCheck() {}

    constructor(public herror: Other.HandleableError) {
        super(herror.internalMessage, herror)
    }

    public override getDisplayMessage(): string {
        return this.herror.getDisplayMessage()
    }
}

export class HErrorSingleParam<ParameterT = unknown> extends Other.HandleableError {
    private __nominalHErrorSingleParam() { }

    public parameter: CmdGeneralParameter

    constructor(parameter: ParameterT, public externalMessage: string, cause?: Error) {
        const typedParameter = parameter as CmdGeneralParameter
        super(`${typedParameter.name}: ${externalMessage}`, cause)

        this.parameter = typedParameter
    }

    static fromParamValueCheck<ParameterT = unknown>(herror: HErrorParamValueCheck, parameter: ParameterT) {
        return new HErrorSingleParam(parameter, herror.getDisplayMessage(), herror)
    }

    public getListDisplay() {
        return `${Djs.inlineCode(this.parameter.name)}: ${this.externalMessage}`
    }

    public override getDisplayMessage(): string {
        return `You have given an invalid argument for the parameter ${this.getListDisplay()}`
    }
}

export class HErrorReferredParams<ParametersT = unknown> extends Other.HandleableError {
    private __nominalHErrorReferredParams() {}

    public referredParameters: CmdGeneralParameter[]

    constructor(referredParameters: ParametersT, public herror: Other.HandleableError) {
        const typedReferredParameters = referredParameters as CmdGeneralParameter[]
        super(`${typedReferredParameters.map(param => param.name).join(", ")}: ${herror.getDisplayMessage()}`, herror)

        this.referredParameters = typedReferredParameters
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
    interaction: UseScope.AllScopedCommandInteraction,
    parameters: Parameters,
): Promise<ParamsToValueMap<Parameters>> {
    const results = []
    const errors: HErrorSingleParam[] = []
    for (const parameter of parameters) {
        try {
            results.push(await parameter.getValue(interaction.options))
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