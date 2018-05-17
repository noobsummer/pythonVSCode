// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this no-require-imports no-var-requires no-any

import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
const Module = require('module');

type VSCode = typeof vscode;

const mockedVSCode: Partial<VSCode> = {};

const originalLoad = Module._load;
Module._load = function (request, parent) {
    if (request === 'vscode') {
        return mockedVSCode;
    }
    return originalLoad.apply(this, arguments);
};

export function mock<K extends keyof VSCode>(name: K): TypeMoq.IMock<VSCode[K]> {
    const mockedObj = TypeMoq.Mock.ofType<VSCode[K]>();
    mockedVSCode[name] = mockedObj.object;
    return mockedObj;
}

// This is one of the very few classes that we need in our unit tests.
// It is constructed in a number of places, and this is required for verification.
// Using mocked objects for verfications does not work in typemoq.
export class Uri implements vscode.Uri {
    private constructor(public readonly scheme: string, public readonly authority: string,
        public readonly path: string, public readonly query: string,
        public readonly fragment: string, public readonly fsPath) {

    }
    public static file(path: string): Uri {
        return new Uri('file', '', path, '', '', path);
    }
    public static parse(value: string): Uri {
        return new Uri('http', '', value, '', '', value);
    }
    public with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): vscode.Uri {
        throw new Error('Not implemented');
    }
    public toString(skipEncoding?: boolean): string {
        throw new Error('Not implemented');
    }
    public toJSON(): any {
        return this.fsPath;
    }
}
