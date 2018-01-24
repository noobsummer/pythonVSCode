import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { Architecture, IRegistry, RegistryHive } from '../../../common/platform/types';
import { Is64Bit } from '../../../common/types';
import { IInterpreterLocatorService, InterpreterType, PythonInterpreter } from '../../contracts';
import { AnacondaCompanyName, AnacondaCompanyNames } from './conda';
import { debugLog } from '../../../dbgLogging';

// tslint:disable-next-line:variable-name
const DefaultPythonExecutable = 'python.exe';
// tslint:disable-next-line:variable-name
const CompaniesToIgnore = ['PYLAUNCHER'];
// tslint:disable-next-line:variable-name
const PythonCoreCompanyDisplayName = 'Python Software Foundation';
// tslint:disable-next-line:variable-name
const PythonCoreComany = 'PYTHONCORE';

type CompanyInterpreter = {
    companyKey: string,
    hive: RegistryHive,
    arch?: Architecture
};

@injectable()
export class WindowsRegistryService implements IInterpreterLocatorService {
    constructor( @inject(IRegistry) private registry: IRegistry, @inject(Is64Bit) private is64Bit: boolean) {

    }
    // tslint:disable-next-line:variable-name
    public getInterpreters(_resource?: Uri) {
        return this.getInterpretersFromRegistry();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async getInterpretersFromRegistry() {
        debugLog(`Start getInterpretersFromRegistry`);
        // https://github.com/python/peps/blob/master/pep-0514.txt#L357
        const hkcuArch = this.is64Bit ? undefined : Architecture.x86;

        debugLog(`Start getInterpretersFromRegistry 1. HKCU ${hkcuArch}`);
        const one = await this.getCompanies(RegistryHive.HKCU, hkcuArch);
        debugLog(`End getInterpretersFromRegistry 1. HKCU ${hkcuArch}, ${one.length}`);
        debugLog(`End getInterpretersFromRegistry 1. HKCU ${hkcuArch}, ${JSON.stringify(one)}`);

        debugLog(`Start getInterpretersFromRegistry 2. HKLM x86`);
        const two = await this.getCompanies(RegistryHive.HKLM, Architecture.x86);
        debugLog(`End getInterpretersFromRegistry 2. HKLM x86, ${two.length}`);
        debugLog(`End getInterpretersFromRegistry 2. HKLM x86, ${JSON.stringify(two)}`);

        const companies: CompanyInterpreter[] = [];
        debugLog(`Start getCompanies 3. HKCU ${hkcuArch}`);
        const promise1 = await this.getCompanies(RegistryHive.HKCU, hkcuArch);
        companies.push(...promise1);
        debugLog(`End getCompanies 3. HKCU ${hkcuArch}, ${promise1.length}`);
        debugLog(`End getCompanies 3. HKCU ${hkcuArch}, ${JSON.stringify(promise1)}`);

        debugLog(`Start getCompanies 4. HKLM ${Architecture.x86}`);
        const promise2 = await this.getCompanies(RegistryHive.HKLM, Architecture.x86);
        companies.push(...promise2);
        debugLog(`End getCompanies 4. HKLM ${Architecture.x86}, ${promise1.length}`);
        debugLog(`End getCompanies 4. HKLM ${Architecture.x86}, ${JSON.stringify(promise1)}`);

        // const promises: Promise<CompanyInterpreter[]>[] = [
        //     this.getCompanies(RegistryHive.HKCU, hkcuArch),
        //     this.getCompanies(RegistryHive.HKLM, Architecture.x86)
        // ];
        // https://github.com/Microsoft/PTVS/blob/ebfc4ca8bab234d453f15ee426af3b208f3c143c/Python/Product/Cookiecutter/Shared/Interpreters/PythonRegistrySearch.cs#L44
        if (this.is64Bit) {
            debugLog(`Start getInterpretersFromRegistry 3. HKLM 64`);
            const three = await this.getCompanies(RegistryHive.HKLM, Architecture.x64);
            debugLog(`End getInterpretersFromRegistry 3. HKLM 64 ${three.length}`);
            debugLog(`End getInterpretersFromRegistry 3. HKLM 64 ${JSON.stringify(three)}`);

            // promises.push(this.getCompanies(RegistryHive.HKLM, Architecture.x64));

            debugLog(`Start getCompanies 5. HKLM ${Architecture.x64}`);
            const promise3 = await this.getCompanies(RegistryHive.HKLM, Architecture.x64);
            companies.push(...promise3);
            debugLog(`End getCompanies 5. HKLM ${Architecture.x64}, ${promise3.length}`);
            debugLog(`End getCompanies 5. HKLM ${Architecture.x64}, ${JSON.stringify(promise3)}`);
        }

        // const companies = await Promise.all<CompanyInterpreter[]>(promises);
        debugLog(`Start getInterpretersFromRegistry (end get companies) ${companies.length}`);
        const flattenedList = _.flatten(companies).filter(item => item !== undefined && item !== null);
        debugLog(`Start getInterpretersFromRegistry (end get companies) flattened ${flattenedList.length}`);
        // tslint:disable-next-line:underscore-consistent-invocation
        const companyInterpreters = await Promise.all(flattenedList
            .map(async company => {
                debugLog(`Start getInterpretersFromRegistry (start for company) ${JSON.stringify(company)}`);
                const info = await this.getInterpretersForCompany(company.companyKey, company.hive, company.arch);
                debugLog(`Start getInterpretersFromRegistry (end for company) ${JSON.stringify(company)}`);
                debugLog(`Start getInterpretersFromRegistry (end for company) company info ${info.length}`);
                debugLog(`Start getInterpretersFromRegistry (end for company) company info ${JSON.stringify(info)}`);
                return info;
            }));
        debugLog(`Start getInterpretersFromRegistry (end flatten companies)`);
        // tslint:disable-next-line:underscore-consistent-invocation
        return _.flatten(companyInterpreters)
            .filter(item => item !== undefined && item !== null)
            // tslint:disable-next-line:no-non-null-assertion
            .map(item => item!)
            .reduce<PythonInterpreter[]>((prev, current) => {
                if (prev.findIndex(item => item.path.toUpperCase() === current.path.toUpperCase()) === -1) {
                    prev.push(current);
                }
                return prev;
            }, []);
    }
    private async getCompanies(hive: RegistryHive, arch?: Architecture): Promise<CompanyInterpreter[]> {
        debugLog(`Start getCompanies ${hive}, ${arch}`);
        return this.registry.getKeys('\\Software\\Python', hive, arch)
            .then(companyKeys => companyKeys
                .filter(companyKey => CompaniesToIgnore.indexOf(path.basename(companyKey).toUpperCase()) === -1)
                .map(companyKey => {
                    debugLog(`End getCompanies ${hive}, ${arch}`);
                    return { companyKey, hive, arch };
                }))
            .catch(ex => {
                debugLog(`End getCompanies ${hive}, ${arch}, with errors`);
                debugLog(`${ex.message}`);
                debugLog(`${ex.toString()}`);
                console.error(`End getCompanies with errors`, ex);
                return Promise.reject(ex);
            });
    }
    private async getInterpretersForCompany(companyKey: string, hive: RegistryHive, arch?: Architecture) {
        debugLog(`Start getInterpretersForCompany ${companyKey}, ${hive}, ${arch}`);
        const tagKeys = await this.registry.getKeys(companyKey, hive, arch);
        debugLog(`End getInterpretersForCompany ${companyKey}, ${hive}, ${arch}`);
        debugLog(`Start getInterpretersForCompany (gtt details) ${companyKey}, ${hive}, ${arch}`);
        const details = await Promise.all(tagKeys.map(tagKey => this.getInreterpreterDetailsForCompany(tagKey, companyKey, hive, arch)));
        debugLog(`End getInterpretersForCompany (got details) ${companyKey}, ${hive}, ${arch}`);
        return details;
    }
    private getInreterpreterDetailsForCompany(tagKey: string, companyKey: string, hive: RegistryHive, arch?: Architecture): Promise<PythonInterpreter | undefined | null> {
        debugLog(`Start getInreterpreterDetailsForCompany ${tagKey}, ${companyKey}, ${hive}, ${arch}`);
        const key = `${tagKey}\\InstallPath`;
        type InterpreterInformation = null | undefined | {
            installPath: string,
            executablePath?: string,
            displayName?: string,
            version?: string,
            companyDisplayName?: string
        };
        return this.registry.getValue(key, hive, arch)
            .then(async installPath => {
                // Install path is mandatory.
                if (!installPath) {
                    return null;
                }
                // Check if 'ExecutablePath' exists.
                // Remember Python 2.7 doesn't have 'ExecutablePath' (there could be others).
                // Treat all other values as optional.
                // return Promise.all([
                const installedPath = installPath;
                debugLog(`installedPath = ${installedPath}`);

                const executablePath = await this.registry.getValue(key, hive, arch, 'ExecutablePath');
                debugLog(`executablePath = ${executablePath}`);

                // tslint:disable-next-line:no-non-null-assertion
                const displayName = await this.getInterpreterDisplayName(tagKey, companyKey, hive, arch);
                debugLog(`displayName = ${displayName}`);

                const version = await this.registry.getValue(tagKey, hive, arch, 'SysVersion');
                debugLog(`version = ${version}`);
                let companyDisplayName = await this.getCompanyDisplayName(companyKey, hive, arch);
                debugLog(`companyDisplayName = ${companyDisplayName}`);

                // ])
                // .then(([installedPath, executablePath, displayName, version, companyDisplayName]) => {
                companyDisplayName = AnacondaCompanyNames.indexOf(companyDisplayName) === -1 ? companyDisplayName : AnacondaCompanyName;
                // tslint:disable-next-line:prefer-type-cast
                return { installPath: installedPath, executablePath, displayName, version, companyDisplayName } as InterpreterInformation;
                // });
            })
            .then((interpreterInfo?: InterpreterInformation) => {
                debugLog(`End getInreterpreterDetailsForCompany ${tagKey}, ${companyKey}, ${hive}, ${arch}`);
                debugLog(`End getInreterpreterDetailsForCompany ${tagKey}, ${companyKey}, ${hive}, ${arch}, ${JSON.stringify(interpreterInfo)}`);
                if (!interpreterInfo) {
                    return;
                }

                const executablePath = interpreterInfo.executablePath && interpreterInfo.executablePath.length > 0 ? interpreterInfo.executablePath : path.join(interpreterInfo.installPath, DefaultPythonExecutable);
                const displayName = interpreterInfo.displayName;
                const version = interpreterInfo.version ? path.basename(interpreterInfo.version) : path.basename(tagKey);
                // tslint:disable-next-line:prefer-type-cast
                return {
                    architecture: arch,
                    displayName,
                    path: executablePath,
                    version,
                    companyDisplayName: interpreterInfo.companyDisplayName,
                    type: InterpreterType.Unknown
                } as PythonInterpreter;
            })
            .then(interpreter => interpreter ? fs.pathExists(interpreter.path).catch(() => false).then(exists => exists ? interpreter : null) : null)
            .catch(error => {
                debugLog(`End getInreterpreterDetailsForCompany ${tagKey}, ${companyKey}, ${hive}, ${arch}`);
                debugLog(`${error.message}`);
                debugLog(`${error.toString()}`);
                console.error(`Failed to retrieve interpreter details for company ${companyKey},tag: ${tagKey}, hive: ${hive}, arch: ${arch}`);
                console.error(error);
                return null;
            });
    }
    private async getInterpreterDisplayName(tagKey: string, companyKey: string, hive: RegistryHive, arch?: Architecture) {
        const displayName = await this.registry.getValue(tagKey, hive, arch, 'DisplayName');
        if (displayName && displayName.length > 0) {
            return displayName;
        }
    }
    private async  getCompanyDisplayName(companyKey: string, hive: RegistryHive, arch?: Architecture) {
        const displayName = await this.registry.getValue(companyKey, hive, arch, 'DisplayName');
        if (displayName && displayName.length > 0) {
            return displayName;
        }
        const company = path.basename(companyKey);
        return company.toUpperCase() === PythonCoreComany ? PythonCoreCompanyDisplayName : company;
    }
}
