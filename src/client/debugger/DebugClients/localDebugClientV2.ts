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
<<<<<<< 8020cb03529c53726d3eeb013acde4a63338fb8f
<<<<<<< 157f392165ac177707587117ecf76faffe5c4062
=======
>>>>>>> :hammer: refactor and enable launch without debug
        const noDebugArg = this.args.noDebug ? ['--nodebug'] : [];
        return ['-m', 'ptvsd', ...noDebugArg, '--host', 'localhost', '--port', debugPort.toString()];
    }
    protected buildStandardArguments() {
        const programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        if (typeof this.args.module === 'string' && this.args.module.length > 0) {
            return ['-m', this.args.module, ...programArgs];
        }
        if (this.args.program && this.args.program.length > 0) {
            return ['--file', this.args.program, ...programArgs];
        }
        return programArgs;
<<<<<<< 8020cb03529c53726d3eeb013acde4a63338fb8f
=======
        return [cwd, debugPort.toString()];
>>>>>>> no debug launcher
=======
>>>>>>> :hammer: refactor and enable launch without debug
    }
}
