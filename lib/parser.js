/**
 * Expression parser and tokenizer
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var stringStream = require('string-stream');
	var tok = require('./token');

	var ops1 = ['-'];
	var ops2 = ['+', '-', '*', '/', ',', '=', '==', '<', '<=', '>', '>=', '!='];
	var reVar = /^[@\$][\w\-_]*/i;
	var reNum = /^([\d\.])([a-z]+)?/;

	var PRIMARY      = 1 << 0;
	var OPERATOR     = 1 << 1;
	var FUNCTION     = 1 << 2;
	var LPAREN       = 1 << 3;
	var RPAREN       = 1 << 4;
	var COMMA        = 1 << 5;
	var SIGN         = 1 << 6;
	var CALL         = 1 << 7;
	var NULLARY_CALL = 1 << 8;

	var TNUMBER  = 0;
	var TOP1     = 1;
	var TOP2     = 2;
	var TVAR     = 3;
	var TFUNCALL = 4;

	// Ported from the yajjl JSON parser at http://code.google.com/p/yajjl/
	function unescape(v) {
		var buffer = [];
		var escaping = false;

		for (var i = 0; i < v.length; i++) {
			var c = v.charAt(i);

			if (escaping) {
				switch (c) {
				case "'":
					buffer.push("'");
					break;
				case '\\':
					buffer.push('\\');
					break;
				case '/':
					buffer.push('/');
					break;
				case 'b':
					buffer.push('\b');
					break;
				case 'f':
					buffer.push('\f');
					break;
				case 'n':
					buffer.push('\n');
					break;
				case 'r':
					buffer.push('\r');
					break;
				case 't':
					buffer.push('\t');
					break;
				case 'u':
					// interpret the following 4 characters as the hex of the unicode code point
					var codePoint = parseInt(v.substring(i + 1, i + 5), 16);
					buffer.push(String.fromCharCode(codePoint));
					i += 4;
					break;
				default:
					throw new Error("Illegal escape sequence: '\\" + c + "'");
				}
				escaping = false;
			} else {
				if (c == '\\') {
					escaping = true;
				} else {
					buffer.push(c);
				}
			}
		}

		return buffer.join('');
	}


	function addFunc(token, state, type) {
		var operator = new Token(type, token, state);
		var ops = state.operators;
		while (ops.length > 0) {
			if (operator.priority <= ops[ops.length - 1].priority) {
				state.tokens.push(ops.pop());
			} else {
				break;
			}
		}
		ops.push(saveRange(operator, state));
	}

	function saveRange(token, state) {
		token._startPos = state.stream.start;
		token._endPos = state.stream.pos;
		return token;
	}

	function error(name, stream) {
		if (stream) {
			name += ' at character ' + stream.start;
		}
		throw new Error(name);
	}

	/**
	 * Parser token
	 * @param {String} value
	 * @param {Number} priority
	 */
	function pt(value, priority) {
		return new ParserToken(value, priority);
	}

	function isSign(token) {
		return isPositiveSign(token) || isNegativeSign(token);
	}

	function isPositiveSign(token) {
		return token.value === '+'
	}

	function isNegativeSign(token) {
		return token.value === '-';
	}

	function isOperator(stream) {
		var ch = stream.next();

		switch (ch) {
			case '+':
				return tok.op2(stream, 1);
			
			case '-':
				// this is a tricky one: might be a dash before vendor-prefixed
				// property: -webkit-transform
				if (!/[a-z]/i.test(stream.peek())) {
					return tok.op2(stream, 1);
				}
				break;
			
			case '|':
				if (stream.peek() === '|') {
					stream.next();
					return tok.op2(stream, 1);
				}
				break;
			
			case '*':
			// case '%':
				return tok.op2(stream, 2);
			
			case '/':
			// case '^':
				return tok.op2(stream, 3);

			case '!':
			case '<':
			case '>':
			case '=':
				if (stream.peek() === '=') {
					stream.next();
				}
				return tok.op2(stream);
		}

		stream.backUp(1);
		return false;
	}

	function isComment(stream) {
		if (stream.next() === '/' && stream.peek() === '*') {
			stream.next();
			if (stream.skipTo('*/')) {
				stream.pos += 2;
				return true;
			}

			stream.backUp(1);
			error('Unterminated comment', stream);
		}

		stream.backUp(1);
		return false;
	}

	function isWhite(stream) {
		return stream.eatSpace();
	}

	function isNumber(stream) {
		// fast check if we're dealing with numbers
		var code = stream.peek().charCodeAt(0);
		if (!(code >= 48 && code <= 57)) {
			return false;
		}

		var value, m;

		if (m = stream.string.slice(stream.pos).match(reNum)) {
			value = parseFloat(m[1]);
			if (isNaN(value)) {
				error('Invalid number "' + m[1] + '"', stream);
			}
			stream.pos += m[0].length;
			var token = tok.number(value);
			token.unit = m[2] || '';
			return token;
		}

		return false;
	}

	function isString(stream) {
		var ch = stream.next();
		if (ch === '"' || ch === "'") {
			if (stream.skipString(ch)) {
				return pt(unescape(stream.current()));
			}

			error('Unterminated string', stream);
		}

		stream.backUp(1);
		return false;
	}

	function isLeftParenth(stream, state) {
		if (stream.peek() === '(') {
			stream.next();
			state.priority += 10;
			var token = pt('(', -2);
			token.index -1;
			return token;
		}

		return false;
	}

	function isRightParenth(stream, state) {
		if (stream.peek() === ')') {
			stream.next();
			state.priority -= 10;
			return true;
		}
		
		return false;
	}

	function isComma(stream) {
		if (stream.next() === ',') {
			return pt(',', -1);
		}
		
		stream.backUp(1);
		return false;
	}

	function isOp(stream, ops) {
		var lookup = ops.join('');
		var op = '';
		while (!stream.eol()) {
			if (~lookup.indexOf(stream.peek())) {
				op += stream.next();
			} else {
				break;
			}
		}

		if (op && ~ops.indexOf(op)) {
			return pt(op, 5);
		}

		stream.backUp(op.length);
		return false;
	}

	function isOp1(stream) {
		return isOp(stream, ops1);
	}

	function isOp2(stream) {
		return isOp(stream, ops2);
	}

	function isVar(stream) {
		var ch = stream.peek();
		if (ch === '@' || ch === '$') {
			var m = stream.string.slice(stream.pos).match(reVar);
			if (m) {
				stream.pos += m[0].length;
				return pt(m[0], 4);
			}
		}

		return false;
	}

	return {
		parse: function(expr) {
			var stream = stringStream(expr.trim());
			var token;
			var noperators = 0;
			var expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
			var state = {
				stream: stream,
				tokens: [],
				operators: [],
				priority: 0
			};
			
			while (!stream.eol()) {
				stream.start = stream.pos;

				if (isComment(stream) || isWhite(stream)) {
					continue;
				}

				// TODO parse color
				if (token = isOperator(stream)) {
					if (isSign(token) && (expected & SIGN)) {
						if (isNegativeSign(token)) {
							token.priority = 2;
							noperators++;
							addFunc(token, state, TOP1);
						}
						expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
					} else if (!isComment(stream)) {
						if ((expected & OPERATOR) === 0) {
							error('Unexpected operator', stream);
						}
						noperators += 2;
						addFunc(token, state, TOP2);
						expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
					}
				} else if (token = isNumber(stream)) {
					if ((expected & PRIMARY) === 0) {
						error('Unexpected number', stream);
					}

					state.tokens.push(saveRange(new Token(TNUMBER, token), state));
					expected = (OPERATOR | RPAREN | COMMA);
				} else if (token = isString(stream)) {
					if ((expected & PRIMARY) === 0) {
						error('Unexpected string', stream);
					}

					state.tokens.push(saveRange(new Token(TNUMBER, token), state));
					expected = (OPERATOR | RPAREN | COMMA);
				} else if (token = isLeftParenth(stream, state)) {
					if ((expected & LPAREN) === 0) {
						error('Unexpected "("', stream);
					}

					if (expected & CALL) {
						noperators += 2;
						addFunc(token, state, TFUNCALL);
					}

					expected = (PRIMARY | LPAREN | FUNCTION | SIGN | NULLARY_CALL);
				} else if (isRightParenth(stream)) {
					if (expected & NULLARY_CALL) {
						state.tokens.push(saveRange(new Token(TNUMBER, pt(0)), state));
					} else if ((expected & RPAREN) === 0) {
						error('Unexpected ")"', state);
					}

					expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL);
				} else if (token = isComma(stream)) {
					if ((expected & COMMA) === 0) {
						error('Unexpected ","', stream);
					}
					addFunc(token, state, TOP2);
					noperators += 2;
					expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
				} else if (token = isOp2(stream)) {
					if ((expected & FUNCTION) === 0) {
						error('Unexpected function', stream);
					}
					addFunc(token, state, TOP2);
					noperators += 2;
					expected = (LPAREN);
				} else if (token = isOp1(stream)) {
					if ((expected & FUNCTION) === 0) {
						error('Unexpected function', stream);
					}
					
					addFunc(token, state, TOP1);
					noperators++;
					expected = (LPAREN);
				} else if (token = isVar(stream)) {
					if ((expected & PRIMARY) === 0) {
						error('Unexpected variable', stream);
					}
					var vartoken = new Token(TVAR, token);
					state.tokens.push(saveRange(vartoken, state));

					expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL);
				} else {
					error('Unknown character', stream);
				}
			}

			if (state.priority < 0 || state.priority >= 10) {
				error('Unmatched "()"', stream);
			}
			
			state.tokens = state.tokens.concat(state.operators.reverse());
			
			if (noperators + 1 !== state.tokens.length) {
				error('Parity', stream);
			}

			return state.tokens;
		}
	};
});