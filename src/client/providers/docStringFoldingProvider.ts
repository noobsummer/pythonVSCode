// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, FoldingProvider, FoldingRange, FoldingRangeList, Range, TextDocument } from 'vscode';
import { IterableTextRange } from '../language/iterableTextRange';
import { IToken, TokenizerMode, TokenType } from '../language/types';
import { getDocumentTokens } from './providerUtilities';

export class DocStringFoldingProvider implements FoldingProvider {
    public provideFoldingRanges(document: TextDocument, _: CancellationToken): FoldingRangeList {
        const ranges = this.getFoldingRanges(document);
        return new FoldingRangeList(ranges);
    }

    private getFoldingRanges(document: TextDocument) {
        const tokenCollection = getDocumentTokens(document, document.lineAt(document.lineCount - 1).range.end, TokenizerMode.CommentsAndStrings);
        const tokens = new IterableTextRange(tokenCollection);

        const docStringRanges: FoldingRange[] = [];
        const commentRanges: FoldingRange[] = [];

        for (const token of tokens) {
            const docstringRange = this.getDocStringFoldingRange(document, token);
            if (docstringRange) {
                docStringRanges.push(docstringRange);
                continue;
            }

            const commentRange = this.getSingleLineCommentRange(document, token);
            if (commentRange) {
                this.buildMultiLineCommentRange(commentRange, commentRanges);
            }
        }

        this.removeLastSingleLineComment(commentRanges);
        return docStringRanges.concat(commentRanges);
    }
    private buildMultiLineCommentRange(commentRange: FoldingRange, commentRanges: FoldingRange[]) {
        if (commentRanges.length === 0) {
            commentRanges.push(commentRange);
            return;
        }
        const previousComment = commentRanges[commentRanges.length - 1];
        if (previousComment.endLine + 1 === commentRange.startLine) {
            previousComment.endLine = commentRange.endLine;
            return;
        }
        if (previousComment.startLine === previousComment.endLine) {
            commentRanges[commentRanges.length - 1] = commentRange;
            return;
        }
        commentRanges.push(commentRange);
    }
    private removeLastSingleLineComment(commentRanges: FoldingRange[]) {
        // Remove last comment folding range if its a single line entry.
        if (commentRanges.length === 0) {
            return;
        }
        const lastComment = commentRanges[commentRanges.length - 1];
        if (lastComment.startLine === lastComment.endLine) {
            commentRanges.pop();
        }
    }
    private getDocStringFoldingRange(document: TextDocument, token: IToken) {
        if (token.type !== TokenType.String) {
            return;
        }

        const startPosition = document.positionAt(token.start);
        const endPosition = document.positionAt(token.end);
        if (startPosition.line === endPosition.line) {
            return;
        }

        const startLine = document.lineAt(startPosition);
        if (startLine.firstNonWhitespaceCharacterIndex !== startPosition.character) {
            return;
        }
        const startIndex1 = startLine.text.indexOf('\'\'\'');
        const startIndex2 = startLine.text.indexOf('"""');
        if (startIndex1 !== startPosition.character && startIndex2 !== startPosition.character) {
            return;
        }

        const range = new Range(startPosition, endPosition);

        return new FoldingRange(range.start.line, range.end.line, 'docstring');
    }
    private getSingleLineCommentRange(document: TextDocument, token: IToken) {
        if (token.type !== TokenType.Comment) {
            return;
        }

        const startPosition = document.positionAt(token.start);
        const endPosition = document.positionAt(token.end);
        if (startPosition.line !== endPosition.line) {
            return;
        }
        if (document.lineAt(startPosition).firstNonWhitespaceCharacterIndex !== startPosition.character) {
            return;
        }

        const range = new Range(startPosition, endPosition);
        return new FoldingRange(range.start.line, range.end.line, 'comment');
    }
}
