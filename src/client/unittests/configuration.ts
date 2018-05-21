'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { OutputChannel, Uri, window, workspace } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import { IConfigurationService, IInstaller, IOutputChannel, Product } from '../common/types';
import { getSubDirectories } from '../common/utils';
import { IServiceContainer } from '../ioc/types';
import { TEST_OUTPUT_CHANNEL } from './common/constants';
import { TestConfigurationManager } from './common/managers/testConfigurationManager';
import { TestConfigSettingsService } from './common/services/configSettingService';
import { UnitTestProduct } from './common/types';
import * as nose from './nosetest/testConfigurationManager';
import * as pytest from './pytest/testConfigurationManager';
import { IUnitTestConfigurationService } from './types';
import * as unittest from './unittest/testConfigurationManager';

@injectable()
export class ConfigurationService implements IUnitTestConfigurationService {
    private readonly configurationService: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly installer: IInstaller;
    private readonly outputChannel: OutputChannel;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.installer = serviceContainer.get<IInstaller>(IInstaller);
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
    }
    public async displayTestFrameworkError(wkspace: Uri): Promise<void> {
        const settings = this.configurationService.getSettings(wkspace);
        let enabledCount = settings.unitTest.pyTestEnabled ? 1 : 0;
        enabledCount += settings.unitTest.nosetestsEnabled ? 1 : 0;
        enabledCount += settings.unitTest.unittestEnabled ? 1 : 0;
        if (enabledCount > 1) {
            return promptToEnableAndConfigureTestFramework(wkspace, this.installer, this.outputChannel, 'Enable only one of the test frameworks (unittest, pytest or nosetest).', true);
        } else {
            const option = 'Enable and configure a Test Framework';
            const item = await this.appShell.showInformationMessage('No test framework configured (unittest, pytest or nosetest)', option);
            if (item === option) {
                return promptToEnableAndConfigureTestFramework(wkspace, this.installer, this.outputChannel);
            }
            return Promise.reject(null);
        }
    }
    public async displayPromptToEnableTests(rootDir: string): Promise<void> {
        const settings = this.configurationService.getSettings(Uri.file(rootDir));
        if (settings.unitTest.pyTestEnabled ||
            settings.unitTest.nosetestsEnabled ||
            settings.unitTest.unittestEnabled) {
            return;
        }

        if (!settings.unitTest.promptToConfigure) {
            return;
        }

        const yes = 'Yes';
        const no = 'Later';
        const noNotAgain = 'No, don\'t ask again';

        const hasTests = checkForExistenceOfTests(rootDir);
        if (!hasTests) {
            return;
        }
        const item = await window.showInformationMessage('You seem to have tests, would you like to enable a test framework?', yes, no, noNotAgain);
        if (!item || item === no) {
            return;
        }
        if (item === yes) {
            await promptToEnableAndConfigureTestFramework(workspace.getWorkspaceFolder(Uri.file(rootDir))!.uri, this.installer, this.outputChannel);
        } else {
            const pythonConfig = workspace.getConfiguration('python');
            await pythonConfig.update('unitTest.promptToConfigure', false);
        }
    }
}

// tslint:disable-next-line:no-any
async function promptToEnableAndConfigureTestFramework(wkspace: Uri, installer: IInstaller, outputChannel: OutputChannel, messageToDisplay: string = 'Select a test framework/tool to enable', enableOnly: boolean = false) {
    const selectedTestRunner = await selectTestRunner(messageToDisplay);
    if (typeof selectedTestRunner !== 'number') {
        return Promise.reject(null);
    }
    const configMgr: TestConfigurationManager = createTestConfigurationManager(wkspace, selectedTestRunner, outputChannel, installer);
    if (enableOnly) {
        // Ensure others are disabled
        [Product.unittest, Product.pytest, Product.nosetest]
            .filter(prod => selectedTestRunner !== prod)
            .forEach(prod => {
                createTestConfigurationManager(wkspace, prod, outputChannel, installer).disable()
                    .catch(ex => console.error('Python Extension: createTestConfigurationManager.disable', ex));
            });
        return configMgr.enable();
    }

    return configMgr.configure(wkspace).then(() => {
        return enableTest(wkspace, configMgr);
    }).catch(reason => {
        return enableTest(wkspace, configMgr).then(() => Promise.reject(reason));
    });
}

// Configure everything before enabling.
// Cuz we don't want the test engine (in main.ts file - tests get discovered when config changes are detected)
// to start discovering tests when tests haven't been configured properly.
function enableTest(wkspace: Uri, configMgr: TestConfigurationManager) {
    const pythonConfig = workspace.getConfiguration('python', wkspace);
    // tslint:disable-next-line:no-backbone-get-set-outside-model
    if (pythonConfig.get<boolean>('unitTest.promptToConfigure')) {
        return configMgr.enable();
    }
    return pythonConfig.update('unitTest.promptToConfigure', undefined).then(() => {
        return configMgr.enable();
    }, reason => {
        return configMgr.enable().then(() => Promise.reject(reason));
    });
}
function checkForExistenceOfTests(rootDir: string): Promise<boolean> {
    return getSubDirectories(rootDir).then(subDirs => {
        return subDirs.map(dir => path.relative(rootDir, dir)).filter(dir => dir.match(/test/i)).length > 0;
    });
}
function createTestConfigurationManager(wkspace: Uri, product: Product, outputChannel: OutputChannel, installer: IInstaller) {
    const configSettingService = new TestConfigSettingsService();
    switch (product) {
        case Product.unittest: {
            return new unittest.ConfigurationManager(wkspace, outputChannel, installer, configSettingService);
        }
        case Product.pytest: {
            return new pytest.ConfigurationManager(wkspace, outputChannel, installer, configSettingService);
        }
        case Product.nosetest: {
            return new nose.ConfigurationManager(wkspace, outputChannel, installer, configSettingService);
        }
        default: {
            throw new Error('Invalid test configuration');
        }
    }
}
async function selectTestRunner(placeHolderMessage: string): Promise<UnitTestProduct | undefined> {
    const items = [{
        label: 'unittest',
        product: Product.unittest,
        description: 'Standard Python test framework',
        detail: 'https://docs.python.org/3/library/unittest.html'
    },
    {
        label: 'pytest',
        product: Product.pytest,
        description: 'Can run unittest (including trial) and nose test suites out of the box',
        // tslint:disable-next-line:no-http-string
        detail: 'http://docs.pytest.org/'
    },
    {
        label: 'nose',
        product: Product.nosetest,
        description: 'nose framework',
        detail: 'https://nose.readthedocs.io/'
    }];
    const options = {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: placeHolderMessage
    };
    const selectedTestRunner = await window.showQuickPick(items, options);
    // tslint:disable-next-line:prefer-type-cast
    return selectedTestRunner ? selectedTestRunner.product as UnitTestProduct : undefined;
}
