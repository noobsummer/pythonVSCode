// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import { CancellationTokenSource, FoldingRange, TextDocument } from 'vscode';
import { DocStringFoldingProvider } from '../../client/providers/docStringFoldingProvider';
import { openTextDocument } from '../common';
type FileFoldingRanges = { file: string, ranges: FoldingRange[] };
const pythonFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'folding');

// tslint:disable-next-line:max-func-body-length
suite('Provider - Folding Provider', () => {
    const docStringFileAndExpectedFoldingRanges: FileFoldingRanges[] = [
        {
            file: path.join(pythonFilesPath, 'attach_server.py'), ranges: [
                new FoldingRange(0, 14, 'docstring'), new FoldingRange(44, 73, 'comments'),
                new FoldingRange(95, 143, 'docstring'), new FoldingRange(149, 150, 'comments'),
                new FoldingRange(305, 313, 'docstring'), new FoldingRange(320, 322, 'docstring')
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_ipython_repl.py'), ranges: [
                new FoldingRange(0, 14, 'docstring'), new FoldingRange(78, 79, 'comments'),
                new FoldingRange(81, 82, 'comments'), new FoldingRange(92, 93, 'comments'),
                new FoldingRange(108, 109, 'comments'), new FoldingRange(139, 140, 'comments'),
                new FoldingRange(169, 170, 'comments'), new FoldingRange(275, 277, 'comments'),
                new FoldingRange(319, 320, 'comments')
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_py_debugger.py'), ranges: [
                new FoldingRange(0, 15, 'comments'), new FoldingRange(22, 25, 'comments'),
                new FoldingRange(47, 48, 'comments'), new FoldingRange(69, 70, 'comments'),
                new FoldingRange(96, 97, 'comments'), new FoldingRange(105, 106, 'comments'),
                new FoldingRange(141, 142, 'comments'), new FoldingRange(149, 162, 'comments'),
                new FoldingRange(165, 166, 'comments'), new FoldingRange(207, 208, 'comments'),
                new FoldingRange(235, 237, 'comments'), new FoldingRange(240, 241, 'comments'),
                new FoldingRange(300, 301, 'comments'), new FoldingRange(334, 335, 'comments'),
                new FoldingRange(346, 348, 'comments'), new FoldingRange(499, 500, 'comments'),
                new FoldingRange(558, 559, 'comments'), new FoldingRange(602, 604, 'comments'),
                new FoldingRange(608, 609, 'comments'), new FoldingRange(612, 614, 'comments'),
                new FoldingRange(637, 638, 'comments')
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_py_repl.py'), ranges: []
        }
    ];

    docStringFileAndExpectedFoldingRanges.forEach(item => {
        test(`Test Docstring folding regions '${path.basename(item.file)}'`, async () => {
            const document = await openTextDocument(item.file);
            const provider = new DocStringFoldingProvider();
            const result = provider.provideFoldingRanges(document, new CancellationTokenSource().token);
            expect(result.ranges).to.be.lengthOf(item.ranges.length);
            result.ranges.forEach(range => {
                const index = item.ranges
                    .findIndex(searchItem => searchItem.startLine === range.startLine &&
                        searchItem.endLine === range.endLine);
                expect(index).to.be.greaterThan(-1, `${range.startLine}, ${range.endLine} not found`);
            });
        });
    });
});
