

// tslint:disable:no-console

import * as fs from 'fs';
import { EOL } from 'os';
// import { Range } from 'vscode';
import '../common/extensions';
import { Tokenizer } from './tokenizer';
import { TokenType } from './types';
// import { TokenType } from './types';

export function doSomething() {
    // const file = process.argv.length > 2 ? process.argv[2] : '/home/don/.vscode-insiders/extensions/pythonVSCode/src/client/language/one.py';
    const file = '/home/don/.vscode-insiders/extensions/pythonVSCode/src/client/language/one.py';
    const contents = fs.readFileSync(file).toString();
    const tokenizer = new Tokenizer();

    // Remove empty leading lines
    let nonEmptyLineStarted = false;
    const lines = contents.splitLines({ removeEmptyEntries: false, trim: false }).filter(line => {
        if (!nonEmptyLineStarted && line.trim().length === 0) {
            return false;
        }
        nonEmptyLineStarted = true;
        return true;
    });

    const tokens = tokenizer.tokenize(lines.join(EOL));
    console.log(tokens);

    type LineInfo = { index: number; length: number; trimmedLength: number; start: number; end: number };
    const lineInfo = lines.reduce<LineInfo[]>((previousValue, currentValue, currentIndex) => {
        let currentCharIndex = 0;
        if (previousValue.length > 0) {
            const previousLine = previousValue[previousValue.length - 1];
            currentCharIndex = previousLine.start + previousLine.length;
        }
        previousValue.push({
            index: currentIndex,
            length: currentValue.length + EOL.length,
            trimmedLength: currentValue.trim().length,
            start: currentCharIndex,
            end: currentCharIndex + currentValue.length + EOL.length
        });
        return previousValue;
    }, []);
    console.log(lineInfo);

    function getLineAtCharIndex(charIndex: number) {
        try {
            return lineInfo.filter(line => line.start <= charIndex && line.end >= charIndex)[0].index;
        } catch (ex) {
            console.log(charIndex);
            return -1;
        }
    }
    let previousTokenIsNewLine = false;
    const lineIndexesToRemove: number[] = [];
    for (let index = 0; index < tokens.count; index += 1) {
        const token = tokens.getItemAt(index);
        if (token.type === TokenType.Newline) {
            if (previousTokenIsNewLine !== true) {
                previousTokenIsNewLine = true;
                continue;
            }
            console.log(token.start);
            const lineIndexToRemove = getLineAtCharIndex(token.start + 1);
            lineIndexesToRemove.push(lineIndexToRemove);
        } else {
            previousTokenIsNewLine = false;
        }
    }
    console.log(lineIndexesToRemove);
    const fixedLines = lines.filter((_, index) => lineIndexesToRemove.indexOf(index) === -1);
    console.log(fixedLines.join(EOL));
}
doSomething();
