import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri, window } from 'vscode';
import { PythonSettings } from '../../../common/configSettings';
import { IProcessService } from '../../../common/process/types';
import { debugLog } from '../../../dbgLogging';
import { IInterpreterLocatorService, IInterpreterVersionService, InterpreterType } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';

@injectable()
export class CurrentPathService implements IInterpreterLocatorService {
    public constructor( @inject(IVirtualEnvironmentManager) private virtualEnvMgr: IVirtualEnvironmentManager,
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService,
        @inject(IProcessService) private processService: IProcessService) { }
    public async getInterpreters(resource?: Uri) {
        return this.suggestionsFromKnownPaths();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async suggestionsFromKnownPaths(resource?: Uri) {
        try {
            await window.showInformationMessage('Step 2 (settings)');
            debugLog(`Start suggestionsFromKnownPaths`);
            const currentPythonInterpreter = await this.getInterpreter(PythonSettings.getInstance(resource).pythonPath, '').then(interpreter => [interpreter]);
            await window.showInformationMessage('Step 3 (python)');
            debugLog(`End suggestionsFromKnownPaths ${JSON.stringify(currentPythonInterpreter)}`);
            debugLog(`Start suggestionsFromKnownPaths python`);
            const python = await this.getInterpreter('python', '').then(interpreter => [interpreter]);
            await window.showInformationMessage('Step 4 (python2)');
            debugLog(`End suggestionsFromKnownPaths python ${JSON.stringify(python)}`);
            debugLog(`Start suggestionsFromKnownPaths python2`);
            const python2 = await this.getInterpreter('python2', '').then(interpreter => [interpreter]);
            await window.showInformationMessage('Step 5 (python3)');
            debugLog(`End suggestionsFromKnownPaths python2 ${JSON.stringify(python2)}`);
            debugLog(`Start suggestionsFromKnownPaths python3`);
            const python3 = await this.getInterpreter('python3', '').then(interpreter => [interpreter]);
            await window.showInformationMessage('Step 6 (flatten)');
            debugLog(`End suggestionsFromKnownPaths python3 ${JSON.stringify(python3)}`);
            const interpreters = _.flatten([currentPythonInterpreter, python, python2, python3]).filter(item => item.length > 0);
            // tslint:disable-next-line:promise-function-async
            // tslint:disable-next-line:no-unnecessary-local-variable
            const items = await Promise.all(interpreters.map(async interpreter => {
                debugLog(`Start suggestionsFromKnownPaths.getInterpreterDetails ${interpreter}`);
                const item = this.getInterpreterDetails(interpreter);
                debugLog(`End suggestionsFromKnownPaths.getInterpreterDetails ${interpreter}`);
                return item;
            }));
            await window.showInformationMessage('Step 7 (done)');
            return items;
        } catch (ex) {
            await window.showInformationMessage('Step (Error)');
            debugLog(`End suggestionsFromKnownPaths, error`);
            debugLog(`${ex.message}`);
            debugLog(`${ex.toString()}`);
            return [];
        }
    }
    private async getInterpreterDetails(interpreter: string) {
        try {
            debugLog(`Start suggestionsFromKnownPaths.getInterpreterDetails: ${interpreter}`);
            let displayName = await this.versionProvider.getVersion(interpreter, path.basename(interpreter));
            debugLog(`Start suggestionsFromKnownPaths.getInterpreterDetails: ${interpreter}, displayName = ${displayName}`);
            const virtualEnv = await this.virtualEnvMgr.detect(interpreter);
            debugLog(`Start suggestionsFromKnownPaths.getInterpreterDetails: ${interpreter}, virtualEnv = ${virtualEnv}`);
            debugLog(`End suggestionsFromKnownPaths.getInterpreterDetails: ${interpreter}`);
            displayName += virtualEnv ? ` (${virtualEnv.name})` : '';
            return {
                displayName,
                path: interpreter,
                type: InterpreterType.Unknown
            };
        } catch (ex) {
            debugLog(`End suggestionsFromKnownPaths.getInterpreterDetails with errors: ${interpreter}`);
            debugLog(`${ex.message}`);
            debugLog(`${ex.toString()}`);
            console.error(`End getInterpreterDetails with errors: ${interpreter}`, ex);
            return Promise.reject(ex);
        }
    }
    private async getInterpreter(pythonPath: string, defaultValue: string) {
        await window.showInformationMessage(`Start: getInterpreter() for ${pythonPath}`);
        debugLog(`Start getInterpreter sys.exec: ${pythonPath}`);
        try {
            return this.processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], {})
                .then(output => output.stdout.trim())
                .then(async value => {
                    await window.showInformationMessage(`End: getInterpreter() for ${pythonPath}`);
                    debugLog(`End getInterpreter sys.exec: ${pythonPath}`);
                    return value.length === 0 ? defaultValue : value;
                })
                .catch(async () => {
                    await window.showInformationMessage(`Error: getInterpreter() for ${pythonPath}`);
                    debugLog(`End getInterpreter sys.exec with errors (igored): ${pythonPath}`);
                    return defaultValue;
                });    // Ignore exceptions in getting the executable.
        } catch (ex) {
            debugLog(`Start getInterpreter sys.exec: (crash) ${pythonPath}`);
            debugLog(`Start getInterpreter sys.exec: (crash) ${JSON.stringify(ex)}`);
            debugLog(`Start getInterpreter sys.exec: (crash) ${ex && ex.message ? ex.message : ex}`);
            return defaultValue;
        }
    }
}
