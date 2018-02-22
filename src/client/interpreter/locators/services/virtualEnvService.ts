import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri, workspace } from 'vscode';
import { fsReaddirAsync, IS_WINDOWS } from '../../../common/utils';
import { IInterpreterLocatorService, IInterpreterVersionService, IKnownSearchPathsForVirtualEnvironments, InterpreterType, PythonInterpreter } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';
import { lookForInterpretersInDirectory } from '../helpers';
import * as settings from './../../../common/configSettings';
import { debugLog } from '../../../dbgLogging';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify = require('untildify');

@injectable()
export class VirtualEnvService implements IInterpreterLocatorService {
    public constructor(@inject(IKnownSearchPathsForVirtualEnvironments) private knownSearchPaths: string[],
        @inject(IVirtualEnvironmentManager) private virtualEnvMgr: IVirtualEnvironmentManager,
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService) { }
    public async getInterpreters(resource?: Uri) {
        return this.suggestionsFromKnownVenvs();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async suggestionsFromKnownVenvs() {
        debugLog('Start suggestionsFromKnownVenvs');
        debugLog(`knownSearchPaths = ${this.knownSearchPaths.join(',')}`);
        return Promise.all(this.knownSearchPaths.map(dir => this.lookForInterpretersInVenvs(dir)))
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters));
    }
    private async lookForInterpretersInVenvs(pathToCheck: string) {
        try {
            debugLog(`Start lookForInterpretersInVenvs ${pathToCheck}`);
            const subDirs = await fsReaddirAsync(pathToCheck);
            debugLog(`End lookForInterpretersInVenvs.fsReaddirAsync ${pathToCheck}`);

            debugLog(`Start lookForInterpretersInVenvs.getProspectiveDirectoriesForLookup ${pathToCheck}`);
            let dirs = await Promise.all(this.getProspectiveDirectoriesForLookup(subDirs));
            debugLog(`End lookForInterpretersInVenvs.getProspectiveDirectoriesForLookup ${dirs.join(', ')}`);
            dirs = dirs.filter(dir => dir.length > 0);

            const pathsWithInterpreters = await Promise.all(dirs.map(async item => {
                debugLog(`Start lookForInterpretersInVenvs.lookForInterpretersInDirectory ${item}`);
                const list = await lookForInterpretersInDirectory(item);
                debugLog(`End lookForInterpretersInVenvs.lookForInterpretersInDirectory ${item}`);
                return list;
            }));
            // tslint:disable-next-line:underscore-consistent-invocation
            const flattenedList = _.flatten(pathsWithInterpreters);
            debugLog(`Start lookForInterpretersInVenvs.flattenedList ${flattenedList.length}`);
            const interpreters = await Promise.all(flattenedList.map(async interpreter => {
                debugLog(`Start lookForInterpretersInVenvs.getVirtualEnvDetails ${interpreter}`);
                const item = await this.getVirtualEnvDetails(interpreter);
                debugLog(`End lookForInterpretersInVenvs.getVirtualEnvDetails ${interpreter}`);
                return item;
            }));

            debugLog(`End lookForInterpretersInVenvs ${interpreters.length}`);
            debugLog(`End lookForInterpretersInVenvs ${JSON.stringify(interpreters)}`);

            return interpreters;

        } catch (err) {
            debugLog(`Python Extension (lookForInterpretersInVenvs): ${pathToCheck}, ERROR`);
            debugLog(`${err.message}`);
            debugLog(`${err.toString()}`);
            console.error('Python Extension (lookForInterpretersInVenvs):', err);
            // Ignore exceptions.
            return [] as PythonInterpreter[];
        }
    }
    private getProspectiveDirectoriesForLookup(subDirs: string[]) {
        const dirToLookFor = IS_WINDOWS ? 'SCRIPTS' : 'BIN';
        return subDirs.map(subDir => fsReaddirAsync(subDir)
            .then(dirs => {
                const scriptOrBinDirs = dirs.filter(dir => {
                    const folderName = path.basename(dir);
                    return folderName.toUpperCase() === dirToLookFor;
                });
                return scriptOrBinDirs.length === 1 ? scriptOrBinDirs[0] : '';
            })
            .catch((err) => {
                console.error('Python Extension (getProspectiveDirectoriesForLookup):', err);
                // Ignore exceptions.
                return '';
            }));

    }
    private async getVirtualEnvDetails(interpreter: string): Promise<PythonInterpreter> {
        debugLog(`Start getVirtualEnvDetails ${interpreter}`);
        try {
            const displayName = await this.versionProvider.getVersion(interpreter, path.basename(interpreter));
            debugLog(`Start getVirtualEnvDetails ${interpreter}, displayName = ${displayName}`);
            const virtualEnv = await this.virtualEnvMgr.detect(interpreter);
            debugLog(`Start getVirtualEnvDetails ${interpreter}, virtualEnv = ${virtualEnv}`);
            const virtualEnvSuffix = virtualEnv ? virtualEnv.name : this.getVirtualEnvironmentRootDirectory(interpreter);
            debugLog(`End getVirtualEnvDetails ${interpreter}, virtualEnvSuffix = ${virtualEnvSuffix}`);
            return {
                displayName: `${displayName} (${virtualEnvSuffix})`.trim(),
                path: interpreter,
                type: virtualEnv ? virtualEnv.type : InterpreterType.Unknown
            };
        } catch (ex) {
            debugLog(`End getVirtualEnvDetails ${interpreter} with errors`);
            debugLog(`${ex.message}`);
            debugLog(`${ex.toString()}`);
            console.error(`End getVirtualEnvDetails ${interpreter} with errors`, ex);
            return Promise.reject(ex);
        }
    }
    private getVirtualEnvironmentRootDirectory(interpreter: string) {
        return path.basename(path.dirname(path.dirname(interpreter)));
    }
}

export function getKnownSearchPathsForVirtualEnvs(resource?: Uri): string[] {
    const paths: string[] = [];
    if (!IS_WINDOWS) {
        const defaultPaths = ['/Envs', '/.virtualenvs', '/.pyenv', '/.pyenv/versions'];
        defaultPaths.forEach(p => {
            paths.push(untildify(`~${p}`));
        });
    }
    const venvPath = settings.PythonSettings.getInstance(resource).venvPath;
    if (venvPath) {
        paths.push(untildify(venvPath));
    }
    if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
        if (resource && workspace.workspaceFolders.length > 1) {
            const wkspaceFolder = workspace.getWorkspaceFolder(resource);
            if (wkspaceFolder) {
                paths.push(wkspaceFolder.uri.fsPath);
            }
        } else {
            paths.push(workspace.workspaceFolders[0].uri.fsPath);
        }
    }
    return paths;
}
