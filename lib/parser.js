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
	var reNum = /^(-?[\d\.])([a-z]+)?/;
	var reHexColor = /^#[a-f0-9]+/i;

	var PRIMARY      = 1 << 0;
	var OPERATOR     = 1 << 1;
	var FUNCTION     = 1 << 2;
	var LPAREN       = 1 << 3;
	var RPAREN       = 1 << 4;
	var COMMA        = 1 << 5;
	var SIGN         = 1 << 6;
	var CALL         = 1 << 7;
	var NULLARY_CALL = 1 << 8;

	function addFunc(operator, state) {
		var ops = state.operators;
		operator.priority += state.priority;
		while (ops.length > 0) {
			if (operator.priority <= ops[ops.length - 1].priority) {
				state.tokens.push(ops.pop());
			} else {
				break;
			}
		}
		ops.push(operator);
	}

	function error(name, stream) {
		if (stream) {
			name += ' at character ' + stream.start;
		}
		throw new Error(name);
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
		// var code = stream.peek().charCodeAt(0);
		// if (code !== 45 || !(code >= 48 && code <= 57)) {
		// 	return false;
		// }

		if (stream.match(reNum, true)) {
			return tok.number(stream);
		} 

		return false;
	}

	function isString(stream) {
		var ch = stream.next();
		if (ch === '"' || ch === "'") {
			if (stream.skipString(ch)) {
				return tok.string(stream);
			}

			error('Unterminated string', stream);
		}

		stream.backUp(1);
		return false;
	}

	function isColor(stream) {
		if (stream.peek() !== '#') {
			console.log('not color');
			return false;
		}

		var m = stream.match(reHexColor, true);
		if (!m || (m[0].length !== 4 && m[0].length !== 7)) {
			return false;
		}

		return tok.color(stream);
	}

	function isLeftParenth(stream, state) {
		if (stream.peek() === '(') {
			stream.next();
			state.priority += 10;
			var token = tok(stream, -2);
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
			return tok(stream, -1);
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
			return tok(stream, 5);
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
		if ((ch === '@' || ch === '$') && stream.match(reVar, true)) {
			return tok.variable(stream, 4);
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

				if (token = isColor(stream)) {
					if ((expected & PRIMARY) === 0) {
						error('Unexpected color', stream);
					}

					state.tokens.push(token);
					expected = (OPERATOR | RPAREN | COMMA);
				} else if (token = isNumber(stream)) {
					if ((expected & PRIMARY) === 0) {
						error('Unexpected number', stream);
					}

					state.tokens.push(token);
					expected = (OPERATOR | RPAREN | COMMA);
				} else if (token = isOperator(stream)) {
					if (isSign(token) && (expected & SIGN)) {
						if (isNegativeSign(token)) {
							noperators++;
							addFunc(tok.op1(token, 2), state);
						}
						expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
					} else if (!isComment(stream)) {
						if ((expected & OPERATOR) === 0) {
							error('Unexpected operator', stream);
						}
						noperators += 2;
						addFunc(token, state);
						expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
					}
				} else if (token = isString(stream)) {
					if ((expected & PRIMARY) === 0) {
						error('Unexpected string', stream);
					}

					state.tokens.push(token);
					expected = (OPERATOR | RPAREN | COMMA);
				} else if (token = isLeftParenth(stream, state)) {
					if ((expected & LPAREN) === 0) {
						error('Unexpected "("', stream);
					}

					if (expected & CALL) {
						noperators += 2;
						addFunc(token, state);
					}

					expected = (PRIMARY | LPAREN | FUNCTION | SIGN | NULLARY_CALL);
				} else if (isRightParenth(stream, state)) {
					if (expected & NULLARY_CALL) {
						state.tokens.push(tok.number(0));
					} else if ((expected & RPAREN) === 0) {
						error('Unexpected ")"', state);
					}

					expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL);
				} else if (token = isComma(stream)) {
					if ((expected & COMMA) === 0) {
						error('Unexpected ","', stream);
					}
					addFunc(token, state);
					noperators += 2;
					expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
				} else if (token = isOp2(stream)) {
					if ((expected & FUNCTION) === 0) {
						error('Unexpected function', stream);
					}
					addFunc(token, state);
					noperators += 2;
					expected = (LPAREN);
				} else if (token = isOp1(stream)) {
					if ((expected & FUNCTION) === 0) {
						error('Unexpected function', stream);
					}
					
					addFunc(token, state);
					noperators++;
					expected = (LPAREN);
				} else if (token = isVar(stream)) {
					if ((expected & PRIMARY) === 0) {
						error('Unexpected variable', stream);
					}
					state.tokens.push(token);
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