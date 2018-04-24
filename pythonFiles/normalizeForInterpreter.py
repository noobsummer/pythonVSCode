import ast
import io
import os
import sys
import token
import tokenize


class Visitor(ast.NodeVisitor):
    def __init__(self, lines):
        self._lines = lines
        self.line_numbers_with_nodes = set()
        self.line_numbers_with_statements = []

    def generic_visit(self, node):
        node_type = type(node).__name__
        if hasattr(node, 'col_offset') and hasattr(node, 'lineno') and node.col_offset == 0:
            self.line_numbers_with_nodes.add(node.lineno)
            if isinstance(node, ast.stmt):
                self.line_numbers_with_statements.append(node.lineno)

        ast.NodeVisitor.generic_visit(self, node)    


def _tokenize(source):
    return tokenize.generate_tokens(io.StringIO(source).readline)


def _indent_size(line):
    for index, char in enumerate(line):
        if not char.isspace():
            return index


def _get_global_statement_blocks(source, lines):
    """Gets a list of all global statement blocks.

    The list contains the start and end line numbers of block.

    """
    tree = ast.parse(source)
    visitor = Visitor(lines)
    visitor.visit(tree)

    statement_ranges = []
    for index, line_number in enumerate(visitor.line_numbers_with_statements):
        remaining_line_numbers = visitor.line_numbers_with_statements[index + 1:]
        end_line_number = len(lines) if len(remaining_line_numbers) == 0 else min(remaining_line_numbers) - 1
        current_statement_is_oneline = line_number == end_line_number

        if len(statement_ranges) == 0:
            statement_ranges.append((line_number, end_line_number, current_statement_is_oneline))
            continue
        
        previous_statement = statement_ranges[-1]
        previous_statement_is_oneline = previous_statement[2]
        if previous_statement_is_oneline and current_statement_is_oneline:
            statement_ranges[-1] = (previous_statement[0], end_line_number, True)
        else:
            statement_ranges.append((line_number, end_line_number, current_statement_is_oneline))

    return statement_ranges


def normalize_lines(source):
    """Normalize blank lines for sending to the terminal.

    Blank lines within a statement block are removed to prevent the REPL
    from thinking the block is finished. Newlines are added to separate
    top-level statements so that the REPL does not think there is a syntax
    error.

    """
    lines = source.splitlines(False)
    # Find out if we have any trailing blank lines	
    has_blank_lines = len(lines[-1].strip()) == 0 or source.endswith(os.linesep)

    # Step 1: Remove empty lines.
    tokens = _tokenize(source)
    newlines_indexes_to_remove = (spos[0] for (toknum, tokval, spos, epos, line) in tokens
                                    if len(line.strip()) == 0 and token.tok_name[toknum] == 'NL' and spos[0] == epos[0])

    for line_number in reversed(list(newlines_indexes_to_remove)):
        del lines[line_number - 1]
    
    # Step 2: Add blank lines between each global statement block.
    # A consequtive single lines blocks of code will be treated as a single statement,
    #   just to ensure we do not unnecessarily add too many blank lines.
    source = os.linesep.join(lines)
    tokens = _tokenize(source)
    dedent_indexes = (spos[0] for (toknum, tokval, spos, epos, line) in tokens
                                if toknum == token.DEDENT and _indent_size(line) == 0)

    global_statement_ranges = _get_global_statement_blocks(source, lines)

    for line_number in (start_line for start_line, _, _ in reversed(global_statement_ranges) if start_line > 1):
        lines.insert(line_number - 1, '')
    
    sys.stdout.write(os.linesep.join(lines) + (os.linesep if has_blank_lines else ''))
    sys.stdout.flush()


if __name__ == '__main__':
    contents = sys.argv[1]
    if isinstance(contents, bytes):
        contents = contents.decode('utf8')
    # contents = open('/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/src/test/pythonFiles/terminalExec/sample6_raw.py', 'r').read()
    # sys.stdout.write('contents\n')
    # sys.stdout.write(contents)
    # sys.stdout.write('contents')
    normalize_lines(contents)
