import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArguments, LaunchRequestArguments } from '../Common/Contracts';
import { IDebugLauncherScriptProvider } from '../types';
import { DebugClient } from './DebugClient';
import { DebuggerLauncherScriptProvider, DebuggerV2LauncherScriptProvider, NoDebugLauncherScriptProvider, NoDebugLauncherScriptProviderV2 } from './launcherProvider';
import { LocalDebugClient } from './LocalDebugClient';
import { LocalDebugClientV2 } from './localDebugClientV2';
import { NonDebugClient } from './NonDebugClient';
import { NonDebugClientV2 } from './nonDebugClientV2';
import { RemoteDebugClient } from './RemoteDebugClient';

export function CreateLaunchDebugClient(launchRequestOptions: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean): DebugClient<{}> {
    let launchScriptProvider: IDebugLauncherScriptProvider;
    let debugClientClass: typeof LocalDebugClient;
    if (launchRequestOptions.noDebug === true) {
        launchScriptProvider = launchRequestOptions.type === 'pythonExperimental' ? new NoDebugLauncherScriptProviderV2() : new NoDebugLauncherScriptProvider();
        debugClientClass = launchRequestOptions.type === 'pythonExperimental' ? NonDebugClientV2 : NonDebugClient;
    } else {
        launchScriptProvider = launchRequestOptions.type === 'pythonExperimental' ? new DebuggerV2LauncherScriptProvider() : new DebuggerLauncherScriptProvider();
        debugClientClass = launchRequestOptions.type === 'pythonExperimental' ? LocalDebugClientV2 : LocalDebugClient;
    }
    return new debugClientClass(launchRequestOptions, debugSession, canLaunchTerminal, launchScriptProvider);
}
export function CreateAttachDebugClient(attachRequestOptions: AttachRequestArguments, debugSession: DebugSession): DebugClient<{}> {
    return new RemoteDebugClient(attachRequestOptions, debugSession);
}
