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
    for toknum, _, spos, epos, _ in tokens:
        if toknum == token.DEDENT:
            print(('DEDENT', spos, epos))
        elif token.tok_name[toknum] == 'NL':
            print(('NL', spos, epos))


printTokens(unicode(sys.argv[1]))
