// tslint:disable:no-string-literal

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../client/common/configSettings';
import { activated } from '../client/extension';
import { clearPythonPathInWorkspaceFolder, resetGlobalPythonPathSetting, setPythonPathInWorkspaceRoot } from './common';

export * from './constants';

const dummyPythonFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
const multirootPath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = vscode.Uri.file(path.join(multirootPath, 'workspace3'));

//First thing to be executed.
process.env['VSC_PYTHON_CI_TEST'] = '1';

const PYTHON_PATH = getPythonPath();

// Ability to use custom python environments for testing
export async function initializePython() {
    await resetGlobalPythonPathSetting();
    await clearPythonPathInWorkspaceFolder(dummyPythonFile);
    await clearPythonPathInWorkspaceFolder(workspace3Uri);
    await setPythonPathInWorkspaceRoot(PYTHON_PATH);
}

// tslint:disable-next-line:no-any
export async function initialize(): Promise<any> {
    console.log('1a');
    await initializePython();
    console.log('1b');
    // Opening a python file activates the extension.
    await vscode.workspace.openTextDocument(dummyPythonFile);
    console.log('1c');
    await activated;
    console.log('1d');
    // Dispose any cached python settings (used only in test env).
    PythonSettings.dispose();
    console.log('1e');
}
// tslint:disable-next-line:no-any
export async function initializeTest(): Promise<any> {
    console.log('2a');
    await initializePython();
    console.log('2b');
    await closeActiveWindows();
    console.log('2c');
    // Dispose any cached python settings (used only in test env).
    PythonSettings.dispose();
    console.log('2d');
}
export async function closeActiveWindows(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        vscode.commands.executeCommand('workbench.action.closeAllEditors')
            // tslint:disable-next-line:no-unnecessary-callback-wrapper
            .then(() => resolve(), reject);
        // Attempt to fix #1301.
        // Lets not waste too much time.
        setTimeout(() => {
            reject(new Error('Command \'workbench.action.closeAllEditors\' timedout'));
        }, 15000);
    });
}

function getPythonPath(): string {
    // tslint:disable-next-line:no-unsafe-any
    if (process.env.TRAVIS_PYTHON_PATH && fs.existsSync(process.env.TRAVIS_PYTHON_PATH)) {
        // tslint:disable-next-line:no-unsafe-any
        return process.env.TRAVIS_PYTHON_PATH;
    }
    return 'python';
}
