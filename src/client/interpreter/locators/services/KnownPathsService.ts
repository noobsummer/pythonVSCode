import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { fsExistsAsync, IS_WINDOWS } from '../../../common/utils';
import { IInterpreterLocatorService, IInterpreterVersionService, IKnownSearchPathsForInterpreters, InterpreterType } from '../../contracts';
import { lookForInterpretersInDirectory } from '../helpers';
import { debugLog } from '../../../dbgLogging';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify = require('untildify');

@injectable()
export class KnownPathsService implements IInterpreterLocatorService {
    public constructor( @inject(IKnownSearchPathsForInterpreters) private knownSearchPaths: string[],
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService) { }
    // tslint:disable-next-line:no-shadowed-variable
    public getInterpreters(_?: Uri) {
        return this.suggestionsFromKnownPaths();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async suggestionsFromKnownPaths() {
        debugLog(`Start suggestionsFromKnownPaths ${this.knownSearchPaths.join(', ')}`);
        const promises = this.knownSearchPaths.map(async dir => {
            debugLog(`Start suggestionsFromKnownPaths.getInterpretersInDirectory ${dir}`);
            const items = await this.getInterpretersInDirectory(dir);
            debugLog(`End suggestionsFromKnownPaths.getInterpretersInDirectory ${dir}`);
            return items;
        });
        try {
            debugLog(`Start suggestionsFromKnownPaths wait for promise completion`);
            const listOfInterpreters = await Promise.all(promises);
            debugLog(`Start suggestionsFromKnownPaths promise completed`);
            const interpreters = _.flatten(listOfInterpreters).filter(item => item.length > 0);
            // tslint:disable-next-line:no-unnecessary-local-variable
            const items = await Promise.all(interpreters.map(async interpreter => {
                debugLog(`Start suggestionsFromKnownPaths.getInterpreterDetails ${interpreter}`);
                const item = await this.getInterpreterDetails(interpreter);
                debugLog(`End suggestionsFromKnownPaths.getInterpreterDetails ${interpreter}`);
                return item;
            }));
            debugLog(`End suggestionsFromKnownPaths ${items.length}`);
            return items;
        } catch (ex) {
            debugLog(`End suggestionsFromKnownPaths ERROR`);
            debugLog(`${ex.message}`);
            debugLog(`${ex.toString()}`);
            return [];
        }
    }
    private async getInterpreterDetails(interpreter: string) {
        try {
            debugLog(`Start suggestionsFromKnownPaths.getInterpreterDetails ${interpreter}`);
            const displayName = await this.versionProvider.getVersion(interpreter, path.basename(interpreter));
            debugLog(`Start suggestionsFromKnownPaths.getInterpreterDetails ${interpreter}, displayName = ${displayName}`);
            return {
                displayName,
                path: interpreter,
                type: InterpreterType.Unknown
            };
        } catch (ex) {
            debugLog(`End suggestionsFromKnownPaths.getInterpreterDetails ${interpreter}, ERROR`);
            debugLog(`${ex.message}`);
            debugLog(`${ex.toString()}`);
            return Promise.reject(ex);
        }
    }
    private getInterpretersInDirectory(dir: string) {
        return fsExistsAsync(dir)
            .then(exists => exists ? lookForInterpretersInDirectory(dir) : Promise.resolve<string[]>([]));
    }
}

export function getKnownSearchPathsForInterpreters(): string[] {
    if (IS_WINDOWS) {
        return [];
    } else {
        const paths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'];
        paths.forEach(p => {
            paths.push(untildify(`~${p}`));
        });
        // Add support for paths such as /Users/xxx/anaconda/bin.
        if (process.env.HOME) {
            paths.push(path.join(process.env.HOME, 'anaconda', 'bin'));
            paths.push(path.join(process.env.HOME, 'python', 'bin'));
        }
        return paths;
    }
}
