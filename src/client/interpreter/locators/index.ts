import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Disposable, Uri, window, workspace } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IDisposableRegistry, IsWindows } from '../../common/types';
import { arePathsSame } from '../../common/utils';
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
        const workspaceFolder = workspace.getWorkspaceFolder(resource);
        return workspaceFolder ? workspaceFolder.uri.fsPath : '';
    }
    private async getInterpretersPerResource(resource?: Uri) {
        const locators = await this.getLocators(resource);
        // tslint:disable-next-line:no-any
        await window.showInformationMessage(`${locators.length} Locators ${locators.map(item => (item as any).constructor.name).join(',')}`);
        const promises = locators.map(async provider => provider.getInterpreters(resource));
        await window.showInformationMessage('Before waiting for result');
        const listOfInterpreters = await Promise.all(promises);
        await window.showInformationMessage('after waiting for result');
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
        const locators: IInterpreterLocatorService[] = [];
        // The order of the services is important.
        if (this.platform.isWindows && await showMessageBox('Search Windows Registry?')) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WINDOWS_REGISTRY_SERVICE));
        }
        if (await showMessageBox('Search Conda?')) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CONDA_ENV_SERVICE));
        }
        if (await showMessageBox('Search Conda files?')) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CONDA_ENV_FILE_SERVICE));
        }
        if (await showMessageBox('Search Virtual Environments?')) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, VIRTUAL_ENV_SERVICE));
        }

        if (!this.platform.isWindows && await showMessageBox('Search known Paths?')) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, KNOWN_PATH_SERVICE));
        }
        if (await showMessageBox('Search Current Path?')) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CURRENT_PATH_SERVICE));
        }
        return locators;
    }
}

async function showMessageBox(message: string): Promise<boolean> {
    const option = await window.showInformationMessage(message, 'Yes', 'No');
    return option === 'Yes';
}
