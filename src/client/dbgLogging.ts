import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { OutputChannel } from 'vscode';

let channel: OutputChannel;
const logFile = path.join(__dirname, 'log.log');
fs.writeFileSync(logFile, `Started @ ${new Date().toString()}`);

export function setOutputChannel(outputChannel: OutputChannel) {
    channel = outputChannel;
}
export function debugLog(msg: string) {
    channel.appendLine(msg);
    fs.writeFileSync(logFile, `${EOL}@ ${new Date().toString()}: ${msg}`);
}
