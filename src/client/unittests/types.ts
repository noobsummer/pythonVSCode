// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Disposable, Event, TextDocument, Uri } from 'vscode';
import { PythonSymbolProvider } from '../providers/symbolProvider';
import { CommandSource } from './common/constants';
import { FlattenedTestFunction, ITestManager, TestFile, TestFunction, Tests, TestsToRun } from './common/types';

export const IUnitTestConfigurationService = Symbol('IUnitTestConfigurationService');
export interface IUnitTestConfigurationService {
    displayTestFrameworkError(wkspace: Uri): Promise<void>;
    displayPromptToEnableTests(rootDir: string): Promise<void>;
}

export const ITestResultDisplay = Symbol('ITestResultDisplay');

export interface ITestResultDisplay extends Disposable {
    enabled: boolean;
    readonly onDidChange: Event<void>;
    displayProgressStatus(testRunResult: Promise<Tests>, debug?: boolean): void;
    displayDiscoverStatus(testDiscovery: Promise<Tests>, quietMode?: boolean): Promise<Tests>;
}

export const ITestDisplay = Symbol('ITestDisplay');
export interface ITestDisplay {
    displayStopTestUI(workspace: Uri, message: string): void;
    displayTestUI(cmdSource: CommandSource, wkspace: Uri): void;
    selectTestFunction(rootDirectory: string, tests: Tests): Promise<FlattenedTestFunction>;
    selectTestFile(rootDirectory: string, tests: Tests): Promise<TestFile>;
    displayFunctionTestPickerUI(cmdSource: CommandSource, wkspace: Uri, rootDirectory: string, file: Uri, testFunctions: TestFunction[], debug?: boolean): void;
}

export const IUnitTestManagementService = Symbol('IUnitTestManagementService');
export interface IUnitTestManagementService {
    activate(): Promise<void>;
    activateCodeLenses(symboldProvider: PythonSymbolProvider): Promise<void>;
    getTestManager(displayTestNotConfiguredMessage: boolean, resource?: Uri): Promise<ITestManager | undefined | void>;
    discoverTestsForDocument(doc: TextDocument): Promise<void>;
    autoDiscoverTests(): Promise<void>;
    discoverTests(cmdSource: CommandSource, resource?: Uri, ignoreCache?: boolean, userInitiated?: boolean, quietMode?: boolean): Promise<void>;
    stopTests(resource: Uri): Promise<void>;
    displayStopUI(message: string): Promise<void>;
    displayUI(cmdSource: CommandSource): Promise<void>;
    displayPickerUI(cmdSource: CommandSource, file: Uri, testFunctions: TestFunction[], debug?: boolean): Promise<void>;
    runTestsImpl(cmdSource: CommandSource, resource?: Uri, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<void>;
    runCurrentTestFile(cmdSource: CommandSource): Promise<void>;

    selectAndRunTestFile(cmdSource: CommandSource): Promise<void>;

    selectAndRunTestMethod(cmdSource: CommandSource, resource: Uri, debug?: boolean): Promise<void>;

    viewOutput(cmdSource: CommandSource): void;
}
