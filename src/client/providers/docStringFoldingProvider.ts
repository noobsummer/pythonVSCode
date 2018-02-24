import { CancellationToken, FoldingProvider, FoldingRange, FoldingRangeList, Position, Range, TextDocument } from 'vscode';
import { IterableTextRange } from '../language/iterableTextRange';
import { IToken, TextRange, TokenizerMode, TokenType } from '../language/types';
import { getDocumentTokens } from './providerUtilities';

export class DocStringFoldingProvider implements FoldingProvider {
    public provideFoldingRanges(document: TextDocument, _: CancellationToken): FoldingRangeList {
        const ranges = this.getDocstringTokens(document);
        return new FoldingRangeList(ranges);
    }

    private getDocstringTokens(document: TextDocument) {
        const tokenCollection = getDocumentTokens(document, document.lineAt(document.lineCount - 1).range.end, TokenizerMode.CommentsAndStrings);
        const tokens = new IterableTextRange(tokenCollection);
        const docStringRanges: FoldingRange[] = [];
        for (const token of tokens) {
            const range = this.getDocStringFoldingRange(document, token);
            if (range) {
                docStringRanges.push(range);
            }
        }

        return docStringRanges;
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
        if (startLine.firstNonWhitespaceCharacterIndex < token.start) {
            return;
        }
        const endLine = document.lineAt(endPosition);
        if (endLine.firstNonWhitespaceCharacterIndex > token.end) {
            return;
        }

        const range = new Range(startPosition, endPosition);
        const text = document.getText(range);

        if (!text.startsWith('\'\'\'') && !text.startsWith('"""')) {
            return;
        }

        return new FoldingRange(range.start.line, range.end.line, text.substring(0, Math.min(text.length, 50)));
    }
}
