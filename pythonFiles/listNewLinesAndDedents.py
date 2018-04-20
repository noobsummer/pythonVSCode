import io
import sys
import token
import tokenize

try:
    unicode
except:
    unicode = str

def printTokens(content):
    tokens = tokenize.generate_tokens(io.StringIO(content).readline)
    newline_detected = False
    for toknum, _, spos, epos, line in tokens:
        if len(line.strip()) > 0:
            continue
        elif toknum == token.DEDENT and spos[0] == epos[0] and newline_detected:
            print('DEDENT, {}'.format(spos[0], epos[0]))
        elif token.tok_name[toknum] == 'NL' and spos[0] == epos[0]:
            newline_detected = True
            print('NL, {}'.format(spos[0], epos[0]))

printTokens(unicode(sys.argv[1]))
