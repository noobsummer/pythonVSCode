// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../Common/Contracts';
import { IDebugLauncherScriptProvider } from '../types';
import { NonDebugClient } from './NonDebugClient';

export class NonDebugClientV2 extends NonDebugClient {
    // tslint:disable-next-line:no-any
    constructor(args: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean, launcherScriptProvider: IDebugLauncherScriptProvider) {
        super(args, debugSession, canLaunchTerminal, launcherScriptProvider);
    }
    protected buildDebugArguments(cwd: string, debugPort: number): string[] {
        return [cwd, debugPort.toString()];
    }
    protected handleProcessOutput(proc: ChildProcess, _failedToLaunch: (error: Error | string | Buffer) => void) {
        proc.stdout.on('data', data => {
            this.debugSession.sendEvent(new OutputEvent(data.toString(), 'stdout'));
        });
        proc.stderr.on('data', data => this.debugSession.sendEvent(new OutputEvent(data.toString(), 'stderr')));
    }
}
