// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugSession } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../Common/Contracts';
import { IDebugLauncherScriptProvider } from '../types';
import { LocalDebugClient } from './LocalDebugClient';

export class LocalDebugClientV2 extends LocalDebugClient {
    constructor(args: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean, launcherScriptProvider: IDebugLauncherScriptProvider) {
        super(args, debugSession, canLaunchTerminal, launcherScriptProvider);
    }
    protected buildDebugArguments(cwd: string, debugPort: number): string[] {
        return [cwd, debugPort.toString()];
    }
}
