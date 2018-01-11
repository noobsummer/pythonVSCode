import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../common/configSettings';
import { IProcessService } from '../../../common/process/types';
import { IInterpreterLocatorService, IInterpreterVersionService, InterpreterType } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { debugLog } from '../../../dbgLogging';

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
        debugLog(`Start suggestionsFromKnownPaths`);
        const currentPythonInterpreter = await this.getInterpreter(PythonSettings.getInstance(resource).pythonPath, '').then(interpreter => [interpreter]);
        debugLog(`End suggestionsFromKnownPaths ${JSON.stringify(currentPythonInterpreter)}`);
        debugLog(`Start suggestionsFromKnownPaths python`);
        const python = await this.getInterpreter('python', '').then(interpreter => [interpreter]);
        debugLog(`End suggestionsFromKnownPaths python ${JSON.stringify(python)}`);
        debugLog(`Start suggestionsFromKnownPaths python2`);
        const python2 = await this.getInterpreter('python2', '').then(interpreter => [interpreter]);
        debugLog(`End suggestionsFromKnownPaths python2 ${JSON.stringify(python2)}`);
        debugLog(`Start suggestionsFromKnownPaths python2`);
        const python3 = await this.getInterpreter('python3', '').then(interpreter => [interpreter]);
        debugLog(`End suggestionsFromKnownPaths python3 ${JSON.stringify(python3)}`);
        return Promise.resolve([currentPythonInterpreter, python, python2, python3])
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            // tslint:disable-next-line:promise-function-async
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))));
    }
    private async getInterpreterDetails(interpreter: string) {
        debugLog(`Start getInterpreterDetails: ${interpreter}`);
        return Promise.all([
            this.versionProvider.getVersion(interpreter, path.basename(interpreter)),
            this.virtualEnvMgr.detect(interpreter)
        ])
            .then(([displayName, virtualEnv]) => {
                debugLog(`End getInterpreterDetails: ${interpreter}`);
                displayName += virtualEnv ? ` (${virtualEnv.name})` : '';
                return {
                    displayName,
                    path: interpreter,
                    type: InterpreterType.Unknown
                };
            })
            .catch(ex => {
                debugLog(`End getInterpreterDetails with errors: ${interpreter}`);
                console.error(`End getInterpreterDetails with errors: ${interpreter}`, ex);
                return Promise.reject(ex);
            });
    }
    private async getInterpreter(pythonPath: string, defaultValue: string) {
        debugLog(`Start getInterpreter sys.exec: ${pythonPath}`);
        try {
            return this.processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], {})
                .then(output => output.stdout.trim())
                .then(value => {
                    debugLog(`End getInterpreter sys.exec: ${pythonPath}`);
                    return value.length === 0 ? defaultValue : value;
                })
                .catch(() => {
                    debugLog(`End getInterpreter sys.exec with errors (igored): ${pythonPath}`);
                    return defaultValue;
                });    // Ignore exceptions in getting the executable.
        } catch (ex) {
            debugLog(`Start getInterpreter sys.exec: (crash) ${pythonPath}`);
            debugLog(`Start getInterpreter sys.exec: (crash) ${JSON.stringify(ex)}`);
            debugLog(`Start getInterpreter sys.exec: (crash) ${ex && ex.message ? ex.message : ex}`);
        }
    }
}
