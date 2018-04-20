// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { EOL } from 'os';
import * as path from 'path';
import { Range, TextEditor, Uri } from 'vscode';
import { RegistrationRequest } from 'vscode-languageclient/lib/main';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { EXTENSION_ROOT_DIR, PythonLanguage } from '../../common/constants';
import '../../common/extensions';
import { IProcessService } from '../../common/process/types';
import { IConfigurationService } from '../../common/types';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { IServiceContainer } from '../../ioc/types';
import { ICodeExecutionHelper } from '../types';

// Tokens returned by Python Tokenizer.
enum Tokens {
    Dedent = 'DEDENT',
    NewLine = 'NL'
}
type LineAndDedent = {
    type: Tokens.Dedent | Tokens.NewLine;
    lineIndex: number;
};

@injectable()
export class CodeExecutionHelper implements ICodeExecutionHelper {
    private readonly documentManager: IDocumentManager;
    private readonly applicationShell: IApplicationShell;
    private readonly envVariablesProvider: IEnvironmentVariablesProvider;
    private readonly processService: IProcessService;
    private readonly configurationService: IConfigurationService;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.applicationShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.envVariablesProvider = serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
        this.processService = serviceContainer.get<IProcessService>(IProcessService);
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    }
    public async normalizeLines(code: string, resource?: Uri): Promise<string> {
        try {
            if (code.trim().length === 0) {
                return '';
            }
            const lines = code.splitLines({ trim: false, removeEmptyEntries: false });
            // const emptyFirstLine = lines.length > 0 && lines[0].length > 0
            const linesAndDedents = await this.getLinesAndDedents(code, resource);

            const hasTrailingLine = lines[lines.length - 1].trim().length === 0;

            // Remove empty lines
            let nonEmptyLineFound = false;
            const fixedLines = lines
                .reverse()
                .filter((line, i, items) => {
                    const isEmptyLine = line.trim().length === 0;
                    let skipThisLine = false;
                    if (!nonEmptyLineFound) {
                        if (isEmptyLine) {
                            skipThisLine = true;
                        } else {
                            nonEmptyLineFound = true;
                        }
                    }
                    const index = Math.abs(items.length - i - 1);
                    if (skipThisLine || linesAndDedents.findIndex(entry => entry.type === Tokens.NewLine && entry.lineIndex === index) >= 0) {
                        // Adjust line numbers for lines with DEDENTS
                        linesAndDedents
                            .filter(entry => entry.type === Tokens.Dedent && entry.lineIndex >= index)
                            .forEach(entry => entry.lineIndex -= 1);
                        return false;
                    }
                    return true;
                })
                .reverse();

            // Find dendented lines and add blank lines above it
            // We're only interested in lines that are not already indented
            const re = new RegExp('^\\\s+\\S+');
            linesAndDedents
                .filter(entry => entry.type === Tokens.Dedent && entry.lineIndex < fixedLines.length)
                .reverse()
                .forEach(entry => {
                    if (re.test(fixedLines[entry.lineIndex])) {
                        fixedLines.splice(entry.lineIndex, 0, '');
                    } else {
                        // Add a blank line, and ensure that link is indented at this same level
                        const line = fixedLines[entry.lineIndex];
                        const indentation = line.substr(0, line.indexOf(line.trim()));
                        fixedLines.splice(entry.lineIndex, 0, indentation);
                    }
                });

            // If we had a trailing line, then add it
            return fixedLines.join(EOL) + (hasTrailingLine ? EOL : '');
        } catch (ex) {
            console.error(ex, 'Python: Failed to normalize code for execution in terminal');
            return code;
        }
    }

    public async getFileToExecute(): Promise<Uri | undefined> {
        const activeEditor = this.documentManager.activeTextEditor!;
        if (!activeEditor) {
            this.applicationShell.showErrorMessage('No open file to run in terminal');
            return;
        }
        if (activeEditor.document.isUntitled) {
            this.applicationShell.showErrorMessage('The active file needs to be saved before it can be run');
            return;
        }
        if (activeEditor.document.languageId !== PythonLanguage.language) {
            this.applicationShell.showErrorMessage('The active file is not a Python source file');
            return;
        }
        if (activeEditor.document.isDirty) {
            await activeEditor.document.save();
        }
        return activeEditor.document.uri;
    }

    public async getSelectedTextToExecute(textEditor: TextEditor): Promise<string | undefined> {
        if (!textEditor) {
            return;
        }

        const selection = textEditor.selection;
        let code: string;
        if (selection.isEmpty) {
            code = textEditor.document.lineAt(selection.start.line).text;
        } else {
            const textRange = new Range(selection.start, selection.end);
            code = textEditor.document.getText(textRange);
        }
        return code;
    }
    public async saveFileIfDirty(file: Uri): Promise<void> {
        const docs = this.documentManager.textDocuments.filter(d => d.uri.path === file.path);
        if (docs.length === 1 && docs[0].isDirty) {
            await docs[0].save();
        }
    }

    private async getLinesAndDedents(source: string, resource?: Uri): Promise<LineAndDedent[]> {
        const env = await this.envVariablesProvider.getEnvironmentVariables(resource);
        const pythonPath = this.configurationService.getSettings(resource).pythonPath;
        const args = [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'listNewLinesAndDedents.py'), source];
        const proc = await this.processService.exec(pythonPath, args, { env, throwOnStdErr: true });
        const entries = proc.stdout.splitLines({ removeEmptyEntries: true, trim: true });
        return entries.map(line => {
            const parts = line.split(',');
            return {
                type: parts[0] as Tokens,
                lineIndex: parseInt(parts[1], 10) - 1
            };
        });
    }
}
