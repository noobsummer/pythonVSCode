// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import * as TypeMoq from 'typemoq';
import { CancellationToken, DocumentSymbolProvider, TextDocument, Uri } from 'vscode';
import { IFileSystem } from '../../client/common/platform/types';
import { IServiceContainer } from '../../client/ioc/types';
import { JediFactory } from '../../client/languageServices/jediProxyFactory';
import { IDefinition, ISymbolResult, JediProxyHandler } from '../../client/providers/jediProxy';
import { PythonSymbolProvider } from '../../client/providers/symbolProvider';

suite('DocumentSymbol Provider', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let provider: DocumentSymbolProvider;
    let uri: Uri;
    let doc: TypeMoq.IMock<TextDocument>;
    let jediProxyHandler: TypeMoq.IMock<JediProxyHandler<ISymbolResult>>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const jediFactory = TypeMoq.Mock.ofType<JediFactory>();
        jediProxyHandler = TypeMoq.Mock.ofType<JediProxyHandler<ISymbolResult>>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        doc = TypeMoq.Mock.ofType<TextDocument>();
        uri = Uri.file(__filename);

        doc.setup(d => d.uri).returns(() => uri);
        jediFactory.setup(j => j.getJediProxyHandler(TypeMoq.It.isValue(uri)))
            .returns(() => jediProxyHandler.object);
        serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);
        provider = new PythonSymbolProvider(serviceContainer.object, jediFactory.object);
    });

    test('Ensure IFileSystem.arePathsSame is used', async () => {
        doc.setup(d => d.getText())
            .returns(() => '')
            .verifiable(TypeMoq.Times.once());
        doc.setup(d => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        doc.setup(d => d.fileName)
            .returns(() => __filename);

        const symbols = TypeMoq.Mock.ofType<ISymbolResult>();
        symbols.setup((s: any) => s.then).returns(() => undefined);
        const definitions: IDefinition[] = [];
        for (let counter = 0; counter < 3; counter += 1) {
            const def = TypeMoq.Mock.ofType<IDefinition>();
            def.setup(d => d.fileName).returns(() => counter.toString());
            definitions.push(def.object);

            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isValue(counter.toString()), TypeMoq.It.isValue(__filename)))
                .returns(() => false)
                .verifiable(TypeMoq.Times.exactly(1));
        }
        symbols.setup(s => s.definitions)
            .returns(() => definitions)
            .verifiable(TypeMoq.Times.atLeastOnce());

        jediProxyHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(symbols.object))
            .verifiable(TypeMoq.Times.once());

        await provider.provideDocumentSymbols(doc.object, TypeMoq.Mock.ofType<CancellationToken>().object);

        doc.verifyAll();
        symbols.verifyAll();
        fileSystem.verifyAll();
        jediProxyHandler.verifyAll();
    });
});
