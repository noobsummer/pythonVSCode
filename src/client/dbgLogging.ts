import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { OutputChannel } from 'vscode';

let channel: OutputChannel;
const logFile = path.join(__dirname, '..', '..', 'log.log');
fs.appendFile(logFile, EOL);
fs.appendFile(logFile, '*'.repeat(50));
fs.appendFile(logFile, `${EOL}Started @ ${new Date().toString()}`);
fs.appendFile(logFile, EOL);
fs.appendFile(logFile, '*'.repeat(50));

export function setOutputChannel(outputChannel: OutputChannel) {
    channel = outputChannel;
}
export function debugLog(msg: string) {
    fs.appendFile(logFile, `${EOL}@ ${new Date().toString()}: ${msg}`);
}
