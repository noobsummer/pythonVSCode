import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Disposable, Uri, window, workspace } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { arePathsSame } from '../../common/utils';
import { debugLog } from '../../dbgLogging';
import { IServiceContainer } from '../../ioc/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    IInterpreterLocatorService,
    InterpreterType,
    KNOWN_PATH_SERVICE,
    PythonInterpreter,
    VIRTUAL_ENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE
} from '../contracts';
import { fixInterpreterDisplayName } from './helpers';

@injectable()
export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private interpretersPerResource: Map<string, Promise<PythonInterpreter[]>>;
    private disposables: Disposable[] = [];
    private platform: IPlatformService;

    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.interpretersPerResource = new Map<string, Promise<PythonInterpreter[]>>();
        this.disposables.push(workspace.onDidChangeConfiguration(this.onConfigChanged, this));
        serviceContainer.get<Disposable[]>(IDisposableRegistry).push(this);
        this.platform = serviceContainer.get<IPlatformService>(IPlatformService);
    }
    public async getInterpreters(resource?: Uri) {
        const resourceKey = this.getResourceKey(resource);
        if (!this.interpretersPerResource.has(resourceKey)) {
            this.interpretersPerResource.set(resourceKey, this.getInterpretersPerResource(resource));
        }

        return await this.interpretersPerResource.get(resourceKey)!;
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private onConfigChanged() {
        this.interpretersPerResource.clear();
    }
    private getResourceKey(resource?: Uri) {
        if (!resource) {
            return '';
        }
        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length <= 1) {
            return '';
        }
        const workspaceFolder = workspace.getWorkspaceFolder(resource);
        return workspaceFolder ? workspaceFolder.uri.fsPath : '';
    }
    private async getInterpretersPerResource(resource?: Uri) {
        await window.showInformationMessage('Before retrieving individual locators');
        const listOfInterpreters = await this.getLocators(resource);
        await window.showInformationMessage('After retrieving individual locators');
        // tslint:disable-next-line:underscore-consistent-invocation
        return _.flatten(listOfInterpreters)
            .map(fixInterpreterDisplayName)
            .map(item => { item.path = path.normalize(item.path); return item; })
            .reduce<PythonInterpreter[]>((accumulator, current) => {
                if (this.platform.isMac && current.path === '/usr/bin/python') {
                    return accumulator;
                }
                const existingItem = accumulator.find(item => arePathsSame(item.path, current.path));
                if (!existingItem) {
                    accumulator.push(current);
                } else {
                    // Preserve type information.
                    if (existingItem.type === InterpreterType.Unknown && current.type !== InterpreterType.Unknown) {
                        existingItem.type = current.type;
                    }
                }
                return accumulator;
            }, []);
    }
    private async getLocators(resource?: Uri) {
        const interpreters = [];
        let retrievedInterpreters = [];
        const locatorNames: string[] = [];

        // The order of the services is important.
        if (this.platform.isWindows) {
            locatorNames.push(WINDOWS_REGISTRY_SERVICE);
        }
        locatorNames.push(CONDA_ENV_SERVICE);
        locatorNames.push(CONDA_ENV_FILE_SERVICE);
        locatorNames.push(VIRTUAL_ENV_SERVICE);
        if (!this.platform.isWindows) {
            locatorNames.push(KNOWN_PATH_SERVICE);
        }

        locatorNames.push(CURRENT_PATH_SERVICE);

        let counter = 0;
        for (const locatorName of locatorNames) {
            try {
                counter += 1;
                const locator = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, locatorName);
                debugLog('='.repeat(50));
                debugLog(`${counter}. Start using ${locatorName}`);
                await window.showInformationMessage(`${counter}. Start using ${locatorName}`);
                retrievedInterpreters = await locator.getInterpreters(resource);
                debugLog(`${counter}. Done using ${locatorName}`);
                debugLog('='.repeat(50));
                await window.showInformationMessage(`${counter}. Done using ${locatorName}`);
                interpreters.push(retrievedInterpreters);
            } catch (ex) {
                debugLog(`${counter}. Failed using ${locatorName}, ERROR`);
                debugLog(`${ex.message}`);
                debugLog(`${ex.toString()}`);
            }
        }

        return interpreters;
    }
}
