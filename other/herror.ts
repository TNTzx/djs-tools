export abstract class HandleableError extends Error {
    private __nominalAssertFail() { }

    constructor(public internalMessage: string, public cause?: Error) {
        super(internalMessage, {cause: cause})
    }

    public getDisplayMessage() {
        return this.internalMessage
    }
}