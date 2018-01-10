import { OutputChannel } from 'vscode';

let channel: OutputChannel;

export function setOutputChannel(outputChannel: OutputChannel) {
    channel = outputChannel;
}
export function debugLog(msg: string) {
    channel.appendLine(msg);
}
