// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments } from '../Common/Contracts';
import { BaseConfigurationProvider, PythonAttachDebugConfiguration, PythonLaunchDebugConfiguration } from './baseProvider';

@injectable()
export class PythonV2DebugConfigurationProvider extends BaseConfigurationProvider<LaunchRequestArguments, AttachRequestArguments> {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('pythonExperimental', serviceContainer);
    }
    protected provideLaunchDefaults(workspaceFolder: Uri, debugConfiguration: PythonLaunchDebugConfiguration<LaunchRequestArguments>): void {
        super.provideLaunchDefaults(workspaceFolder, debugConfiguration);
        const debugOptions = debugConfiguration.debugOptions!;
        if (debugConfiguration.debugStdLib) {
            debugOptions.push(DebugOptions.DebugStdLib);
        }
        if (debugConfiguration.django) {
            debugOptions.push(DebugOptions.Django);
        }
        if (debugConfiguration.jinja) {
            debugOptions.push(DebugOptions.Jinja);
        }
        if (debugConfiguration.redirectOutput) {
            debugOptions.push(DebugOptions.RedirectOutput);
        }
        if (debugConfiguration.sudo) {
            debugOptions.push(DebugOptions.Sudo);
        }
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            debugOptions.push(DebugOptions.FixFilePathCase);
        }
        if (debugConfiguration.module && debugConfiguration.module.toUpperCase() === 'FLASK'
            && debugOptions.indexOf(DebugOptions.Jinja) === -1
            && debugConfiguration.jinja !== false) {
            debugOptions.push(DebugOptions.Jinja);
        }
    }
    protected provideAttachDefaults(workspaceFolder: Uri, debugConfiguration: PythonAttachDebugConfiguration<AttachRequestArguments>): void {
        super.provideAttachDefaults(workspaceFolder, debugConfiguration);
        const debugOptions = debugConfiguration.debugOptions!;
        if (debugConfiguration.debugStdLib) {
            debugOptions.push(DebugOptions.DebugStdLib);
        }
        if (debugConfiguration.django) {
            debugOptions.push(DebugOptions.Django);
        }
        if (debugConfiguration.jinja) {
            debugOptions.push(DebugOptions.Jinja);
        }
        if (debugConfiguration.redirectOutput) {
            debugOptions.push(DebugOptions.RedirectOutput);
        }

        // We'll need paths to be fixed only in the case where local and remote hosts are the same
        // I.e. only if hostName === 'localhost' or '127.0.0.1' or ''
        const isLocalHost = !debugConfiguration.host || debugConfiguration.host === 'localhost' || debugConfiguration.host === '127.0.0.1';
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows && isLocalHost) {
            debugOptions.push(DebugOptions.FixFilePathCase);
        }
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            debugOptions.push(DebugOptions.WindowsClient);
        }

        if (!debugConfiguration.pathMappings) {
            debugConfiguration.pathMappings = [];
        }
        if (debugConfiguration.localRoot && debugConfiguration.remoteRoot) {
            debugConfiguration.pathMappings!.push({
                localRoot: debugConfiguration.localRoot,
                remoteRoot: debugConfiguration.remoteRoot
            });
        }
    }
}
