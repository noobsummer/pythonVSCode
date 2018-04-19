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
    new_tokens = []
    for toknum, _, spos, epos, line in tokens:
        if toknum == token.DEDENT:
            print(('DEDENT', spos, epos))
        elif token.tok_name[toknum] == 'NL':
            print(('NL', spos, epos))
        else:

def
printTokens(unicode(sys.argv[1]))


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
    new_tokens = []
    for toknum, tokval, spos, epos, line in tokens:
        print(toknum, tokval, spos, epos, line)
        new_tokens.append((token, tokval))
        previous_token = None if len(new_tokens) == 0 else new_tokens[len(new_tokens)-1]
        # if toknum == token.DEDENT:
        #     print(('DEDENT', spos, epos))
        #     new_tokens.append((token, tokval))
        # elif token.tok_name[toknum] == 'NL':
        #     print(('NL', spos, epos, line))
        #     new_tokens.append((token, tokval))
        # else:
        #     new_tokens.append((token, tokval))
    print(tokenize.untokenize(new_tokens).decode('utf-8'))
printTokens(unicode(sys.argv[1]))
