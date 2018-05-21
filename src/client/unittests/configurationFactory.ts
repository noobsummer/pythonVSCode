// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { OutputChannel, Uri } from 'vscode';
import { IInstaller, IOutputChannel, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { TEST_OUTPUT_CHANNEL } from './common/constants';
import { ITestConfigSettingsService } from './common/types';
import * as nose from './nosetest/testConfigurationManager';
import * as pytest from './pytest/testConfigurationManager';
import { ITestConfigurationManagerFactory } from './types';
import * as unittest from './unittest/testConfigurationManager';

@injectable()
export class TestConfigurationManagerFactory implements ITestConfigurationManagerFactory {
    private readonly outputChannel: OutputChannel;
    private readonly installer: IInstaller;
    private readonly configSettingService: ITestConfigSettingsService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        this.installer = serviceContainer.get<IInstaller>(IInstaller);
        this.configSettingService = serviceContainer.get<ITestConfigSettingsService>(ITestConfigSettingsService);
    }
    public create(wkspace: Uri, product: Product) {
        switch (product) {
            case Product.unittest: {
                return new unittest.ConfigurationManager(wkspace, this.outputChannel, this.installer, this.configSettingService);
            }
            case Product.pytest: {
                return new pytest.ConfigurationManager(wkspace, this.outputChannel, this.installer, this.configSettingService);
            }
            case Product.nosetest: {
                return new nose.ConfigurationManager(wkspace, this.outputChannel, this.installer, this.configSettingService);
            }
            default: {
                throw new Error('Invalid test configuration');
            }
        }
    }

}
