# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import io
import os
import sys
import token
import tokenize

try:
    unicode
except:
    unicode = str


def normalizeLines(content):
    """Removes empty lines and adds empty lines only to sepaparate
    indented code. So that the code can be used for execution in
    the Python interactive prompt """

    lines = content.splitlines(False)

    # Find out if we have any trailing blank lines
    has_blank_lines = len(lines[-1].strip()) == 0 or content.endswith(os.linesep)

    # Remove empty lines
    tokens = tokenize.generate_tokens(io.StringIO(content).readline)

    new_lines_to_remove = []
    for toknum, _, spos, epos, line in tokens:
        if token.tok_name[toknum] == 'NL' and len(line.strip()) == 0 and spos[0] == epos[0]:
            new_lines_to_remove.append(spos[0] - 1)
    
    for line_index in reversed(new_lines_to_remove):
        lines.pop(line_index)

    # Add new lines just before every dedent
    content = os.linesep.join(lines)
    tokens = tokenize.generate_tokens(io.StringIO(content).readline)
    dedented_lines = []
    for toknum, _, spos, epos, line in tokens:
        if toknum == token.DEDENT and spos[0] == epos[0] and spos[0] <= len(lines):
            index = spos[0] - 1
            if not index in dedented_lines:
                dedented_lines.append(index)

    for line_index in reversed(dedented_lines):
        line = lines[line_index]
        indent_size = line.index(line.strip())
        indentation = line[0:indent_size]
        lines.insert(line_index, indentation)

    sys.stdout.write(os.linesep.join(lines) + (os.linesep if has_blank_lines else ''))
    sys.stdout.flush()


if __name__ == '__main__':
    contents = unicode(sys.argv[1])
    normalizeLines(contents)
