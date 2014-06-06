/*
 Original source: http://silentmatt.com/javascript-expression-evaluator/
 Based on ndef.parser, by Raphael Graf(r@undefined.ch)
 http://www.undefined.ch/mparser/index.html

 Ported to JavaScript and modified by Matthew Crumley (email@matthewcrumley.com, http://silentmatt.com/)

 You are free to use and modify this code in anyway you find useful. Please leave this comment in the code
 to acknowledge its original source. If you feel like it, I enjoy hearing about projects that use my code,
 but don't feel like you have to let me know or ask permission.

*/

if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var _ = require('lodash');
	var colorMod = require('./color');
	var functions = require('./functions');

	// create binded versions of functions
	var bindedFunctions = {};
	Object.keys(functions).forEach(function(name) {
		var fn = functions[name].bind(functions);
		fn.__expression = name;
		bindedFunctions[name] = fn;
	});

	var TNUMBER = 0;
	var TOP1 = 1;
	var TOP2 = 2;
	var TVAR = 3;
	var TFUNCALL = 4;

	var reUnit = /[a-z%]/i;
	var reHexColorChar = /[a-f0-9]/i;
	var reVarStart = /^[\$@]/;

	function replaceSubstring(string, value, from, to) {
		if (string !== null && typeof string != 'undefined') {
			if (typeof from == 'object') {
				to = from._endPos;
				from = from._startPos;
			}

			return string = string.substring(0, from)
				+ value 
				+ string.substring(to);
		}
	}

	function Token(type_, index_, prio_, number_, unit_) {
		this.type_ = type_;
		this.index_ = index_ || 0;
		this.prio_ = prio_ || 0;
		this.number_ = (number_ !== undefined && number_ !== null) ? number_ : 0;
		this.unit_ = unit_ || 0;
	}

	Token.prototype = {
		clone: function() {
			var clone = new Token();
			for (var p in this) if (this.hasOwnProperty(p)) {
				clone[p] = this[p];
			}
			return clone;
		},
		valueOf: function() {
			switch (this.type_) {
			case TNUMBER:
				if (isColorToken(this)) {
					return colorMod.toCSS(this.number_);
				}

				if (typeof this.number_ == 'string' || typeof this.number_ == 'boolean') {
					return this.number_;
				}

				return this.number_ + this.unit_;
			case TOP1:
			case TOP2:
			case TVAR:
				return this.index_;
			case TFUNCALL:
				return "CALL";
			default:
				return "Invalid Token";
			}
		},
		toString: function() {
			return this.valueOf();
		}
	};

	function Argument(type, value, unit) {
		this.type = type;
		this._value = value;
		this.unit = unit || '';
	}

	Argument.prototype = {
		get value() {
			if (this.type == 'color') {
				if (typeof this._value == 'number') {
					// explicitly convert number to object
					this.value = this._value;
				}
				return colorMod.toDecimal(this._value);
			}

			return this._value;
		},

		set value(val) {
			if (this.type == 'color') {
				this._value = colorMod.parse(val);
			} else {
				this._value = val;
			}
		},

		color: function() {
			if (this.type == 'color') {
				return this._value;
			}
		}
	};

	function Expression(tokens, ops1, ops2, functions, source) {
		this.tokens = tokens;
		this.ops1 = ops1;
		this.ops2 = ops2;
		this.functions = functions;
		this.source = source;
	}

	Expression.prototype = {
		evaluate: function (values) {
			values = values || {};
			var nstack = [];
			var n1;
			var n2;
			var f;
			var L = this.tokens.length;
			var item;
			var out;
			var userVal;
			var i = 0;
			for (i = 0; i < L; i++) {
				item = this.tokens[i];
				var type_ = item.type_;
				if (type_ === TNUMBER) {
					nstack.push(item);
					// nstack.push(item.number_);
				}
				else if (type_ === TOP2) {
					n2 = nstack.pop();
					n1 = nstack.pop();
					f = this.ops2[item.index_];
					nstack.push(f(n1, n2));
				}
				else if (type_ === TVAR) {
					if (item.index_ in values) {
						userVal = values[item.index_];
						if (userVal && userVal.bind) {
							userVal = userVal.bind(values);
							userVal.__expression = item.index_;
						}
						nstack.push(userVal);
					}
					else if (item.index_ in this.functions) {
						nstack.push(this.functions[item.index_]);
					}
					else if (reVarStart.test(item.index_)) {
						throw new Error("undefined variable: " + item.index_);
					}
					else {
						nstack.push(item.index_);
					}
				}
				else if (type_ === TOP1) {
					n1 = nstack.pop();
					f = this.ops1[item.index_];
					nstack.push(f(n1));
				}
				else if (type_ === TFUNCALL) {
					n1 = nstack.pop();
					f = nstack.pop();
					if (f.apply && f.call) {
						userVal = runFn(f, n1);
						if (userVal === null) {
							throw new Error("function returned null");
						}
						nstack.push(userVal);
					}
					else {
						// in case if function doesn’t exist, output it as string
						var args =  Array.isArray(n1) ? n1 : [n1];
						args = args.map(function(a) {
							return typeof a == 'function' ? a.__expression : a;
						});
						nstack.push(f + '(' + _.compact(args).join(', ') + ')');
						// throw new Error(f + " is not a function");
					}
				}
				else {
					throw new Error("invalid Expression");
				}
			}
			if (nstack.length > 1) {
				throw new Error("invalid Expression (parity)");
			}

			out = nstack[0];
			if (typeof out == 'function') {
				out = out.__expression || '__fn__';
			} else if (out instanceof Token) {
				out = out.valueOf();
			} 

			if (Array.isArray(out)) {
				out = out.join(out.glue || ', ');
			}

			return out;
		},

		/**
		 * Safe token is a TNUMBER token that added or substracted
		 * from expression. This token can be safely modified
		 * to produce new expression with expected value
		 * @return {Object} Object with `value` and `op` tokens
		 */
		safeToken: function () {
			var nstack = [];
			var n1, n2, c;
			var item, type, out, side;
			var complexVar = {};
			var candidates = [];

			var candidate = function(value, op, side) {
				return {
					__bad: false,
					value: value,
					op: op,
					side: side
				};
			};

			var isCandidate = function(item) {
				return item && '__bad' in item;
			}

			var isComplexVar = function(item) {
				return item === complexVar || isCandidate(item);
			};

			var bad = function(item) {
				if (isCandidate(item)) {
					item.__bad = true;
				}
				return item;
			}

			for (var i = 0, il = this.tokens.length, item; i < il; i++) {
				item = this.tokens[i];
				type = item.type_;
				if (type === TNUMBER) {
					nstack.push(item);
				} else if (type === TOP2) {
					n2 = nstack.pop();
					n1 = nstack.pop();
					side = null;
					out = null;

					if (item.index_ !== '+' && item.index_ !== '-') {
						bad(n1);
						bad(n2);
						nstack.push(complexVar);
						continue;
					}

					if (!isComplexVar(n2)) {
						out = n2;
						side = 'right';
					} else if (!isComplexVar(n1)) {
						out = n1;
						side = 'left';
					}

					if (out) {
						c = candidate(out, item, side);
						candidates.push(c);
						nstack.push(c);
					} else {
						nstack.push(complexVar);
					}
				} else if (type === TVAR) {
					// might be a variable or color,
					// e.g. `red` or `red()`
					var color = colorMod.fromKeyword(item.index_);
					nstack.push(color ? item : complexVar);
				} else if (type === TOP1) {
					out = nstack.pop();
					if (out.type_ == TNUMBER) {
						out = out.clone();
						out.number_ *= -1;
						out._startPos = item._startPos;
						nstack.push(out);
					} else {
						nstack.push(complexVar);
					}
				} else if (type === TFUNCALL) {
					bad(nstack.pop());
					nstack.pop();
					nstack.push(complexVar);
				}
			}

			if (!candidates.length && nstack.length == 1) {
				// looks like this expression consists of a single value
				var t = nstack[0];
				if (t.type_ === TNUMBER || (t.index_ && colorMod.fromKeyword(t.index_ + ''))) {
					c = candidate(nstack[0], null, 'left');
					c.single = true;
					candidates.push(c);
				}
			}

			candidates = candidates.filter(function(item) {
				return !item.__bad;
			});

			return candidates[candidates.length - 1];
		},

		/**
		 * Returns numeric value of safe token
		 * @return {Number} Returns `null` if safe token is unavailable
		 */
		safeTokenValue: function(safe) {
			safe = safe || this.safeToken();
			if (!safe) {
				return null;
			}

			var result = safe.value.number_;
			if (isColorToken(safe.value)) {
				// it’s a color
				result = colorMod.toDecimal(result);
			}
			if (safe.side == 'right' && safe.op.index_ == '-') {
				result *= -1;
			}

			return result;
		},

		replaceSafeToken: function(value) {
			var safe = this.safeToken();
			if (!safe) {
				return null;
			}
			
			var source = this.source;
			var rt = function(value, from, to) {
				source = replaceSubstring(source, value, from, to);
			};

			if (!value || value == '0') {
				// replacing with zero: remove operand and operation sign
				if (safe.side == 'right') {
					rt('', safe.op._startPos, safe.value._endPos);
				} else {
					if (safe.op && safe.op.index_ == '+') {
						rt('', safe.op);
					}
					
					rt('', safe.value);
				}

				return source.trim().replace(/^-\s+/, '-');
			}

			// do we have to change the sign of safe token?
			var isValueNegative = value.charAt(0) === '-';
			var isSafeNegative = safe.side == 'right' ? safe.op.index_ === '-' : safe.value.number_ < 0;
			if (isValueNegative !== isSafeNegative) {
				// we have to change token value sign
				if (safe.side == 'right') {
					// safe token is on the right side of expression,
					// change sign of operation token
					safe.op.index_ = isSafeNegative ? '+' : '-';
					if (isValueNegative) {
						value = value.substr(1);
					}
					rt(safe.op.index_, safe.op);
				}
			} else if (isValueNegative && safe.side == 'right') {
				value = value.substr(1);
			}

			rt(value, safe.value);
			
			return source;
		},

		variables: function () {
			var L = this.tokens.length;
			var vars = [];
			for (var i = 0; i < L; i++) {
				var item = this.tokens[i];
				if (item.type_ === TVAR && (vars.indexOf(item.index_) == -1)) {
					vars.push(item.index_);
				}
			}

			return vars;
		}
	};

	function runFn(fn, args) {
		if (!Array.isArray(args)) {
			args = [args];
		}

		var result = fn.apply(undefined, args.map(evalArg));
		if (result && typeof result == 'object' && result.type == 'color') {
			result = colorToken(result.value);
		}

		return result;
	}

	function colorToken(val, alpha) {
		if (val instanceof Token) {
			return val;
		}

		return new Token(TNUMBER, 0, 0, colorMod.parse(val, alpha), '#');
	}

	function isColorToken(token) {
		return token.type_ === TNUMBER && (typeof token.number_ == 'object') && !Array.isArray(token.number_);
	}

	/**
	 * Returns type of argument
	 * @param  {Object} arg
	 * @return {String}
	 */
	function argType(arg) {
		if (typeof arg == 'object' && 'type' in arg) {
			return arg.type;
		}

		if (typeof arg == 'number') {
			return 'number';
		}

		if (typeof arg == 'string') {
			if (arg.charAt(0) == '#') {
				return 'color';
			}

			return 'string';
		}

		if (arg instanceof Token) {
			if (isColorToken(arg)) {
				return 'color';
			}
			if (typeof arg.number_ == 'string') {
				return 'string';
			}

			if (arg.type_ === TNUMBER) {
				return 'number';
			}
		}

		return 'unknown';
	}

	function num(item) {
		if (typeof item == 'object') {
			return item instanceof Token ? item.number_ : item.value;
		}

		return item;
	}

	function unit(item) {
		if (typeof item == 'object') {
			return item instanceof Token ? item.unit_ : item.unit;
		}

		return '';
	}

	/**
	 * Evaluates given argument to a number
	 * @param  {Object} arg  Argument to evaluate
	 * @param  {Object} hint A second expression argument as a hint.
	 * Some value transformations depend on both arguments
	 * @return {Number}
	 */
	function evalArg(arg, hint, options) {
		options = options || {};
		var type = argType(arg);

		if (typeof arg == 'function') {
			// Name clash: passed string like `red`, but it
			// was resolved to a function.
			// Force it to be a string
			type = 'string';
			arg = arg.__expression;
		}

		var out = new Argument(type, null, unit(arg));

		var token;
		if (type == 'number') {
			out.value = num(arg);

			if (argType(hint) == 'color') {
				// Second argument is a color. Transform current
				// number to color
				if (options.fixColor) {
					out.value = colorMod.toDecimal(out.value, out.value, out.value);
				}

				out.type = 'color';
			}
		} else if (type == 'color') {
			if (typeof arg == 'string') {
				token = colorToken(arg);
			} else {
				token = colorToken(num(arg));
			}

			out.value = token.number_;
		} else if (type == 'string') {
			arg = num(arg);
			var m = arg.match(/^(\-?\d+(?:\.\d*)?)([a-z%]*)$/i);
			if (m) {
				out.value = parseFloat(m[1]);
				out.unit = m[2];
			} else {
				out.value = arg;
			}
		}

		return out;
	}

	function op(a, b, fn, options) {
		options = options || {};
		var _a = evalArg(a, b, options);
		var _b = evalArg(b, a, options);

		var out = fn(_a.value, _b.value);

		if (typeof out == 'boolean') {
			return out;
		}

		if (_a.type == 'color' || _b.type == 'color') {
			var alpha = 1;

			// inherit alpha value
			// TODO find better algorithm
			if (_a.unit == 'color' && _b.unit == 'color') {
				try {
					alpha = fn(_a.alpha, _b.alpha);
				} catch (e) {}
			} else {
				alpha = _a.unit == 'color' ? _a.alpha : _b.alpha;
			}

			out = colorToken(out, alpha);
		} else {
			out += _a.unit || _b.unit || '';
		}

		return out;
	}

	function _add(a, b) {
		return a + b;
	}
	function add(a, b) {
		return op(a, b, _add, {fixColor: true});
	}

	function _sub(a, b) {
		return a - b;
	}
	function sub(a, b) {
		return op(a, b, _sub, {fixColor: true});
	}

	function _mul(a, b) {
		return a * b;
	}
	function mul(a, b) {
		return op(a, b, _mul);
	}

	function _div(a, b) {
		return a / b;
	}
	function div(a, b) {
		return op(a, b, _div);
	}

	function neg(a) {
		var a = evalArg(a);
		return (-a.value) + a.unit;
	}

	function append(a, b) {
		if (Object.prototype.toString.call(a) != "[object Array]") {
			return [a, b];
		}
		a = a.slice();
		a.push(b);
		return a;
	}

	// comparison operators
	var _cmp = {
		'==': function(a, b) { return a == b; },
		'<': function(a, b) { return a < b; },
		'<=': function(a, b) { return a <= b; },
		'>': function(a, b) { return a > b; },
		'>=': function(a, b) { return a >= b; },
		'!=': function(a, b) { return a != b; }
	};

	function cmp(operator, a, b) {
		return op(a, b, _cmp[operator]);
	}

	function Parser() {
		this.success = false;
		this.errormsg = "";
		this.expression = "";

		this.pos = 0;

		this.tokennumber = 0;
		this.tokenprio = 0;
		this.tokenindex = 0;
		this.tmpprio = 0;

		this.ops1 = {
			"-": neg
		};

		this.ops2 = {
			'+':  add,
			'-':  sub,
			'*':  mul,
			'/':  div,
			',':  append,
			'=':  cmp.bind(null, '=='),
			'==': cmp.bind(null, '=='),
			'<':  cmp.bind(null, '<'),
			'<=': cmp.bind(null, '<='),
			'>':  cmp.bind(null, '>'),
			'>=': cmp.bind(null, '>='),
			'!=': cmp.bind(null, '!=')
		};

		this.functions = bindedFunctions;

		this.consts = {
			"E": Math.E,
			"PI": Math.PI
		};
	}

	Parser.parse = function (expr) {
		return new Parser().parse(expr);
	};

	Parser.evaluate = function (expr, variables) {
		return Parser.parse(expr).evaluate(variables);
	};

	Parser.op = op;
	Parser.evalArg = evalArg;
	Parser.argType = argType;
	Parser.colorToken = colorToken;

	Parser.Expression = Expression;

	Parser.values = {
		E: Math.E,
		PI: Math.PI
	};

	var PRIMARY      = 1 << 0;
	var OPERATOR     = 1 << 1;
	var FUNCTION     = 1 << 2;
	var LPAREN       = 1 << 3;
	var RPAREN       = 1 << 4;
	var COMMA        = 1 << 5;
	var SIGN         = 1 << 6;
	var CALL         = 1 << 7;
	var NULLARY_CALL = 1 << 8;

	Parser.prototype = {
		parse: function (expr) {
			this.errormsg = "";
			this.success = true;
			var operstack = [];
			var tokenstack = [];
			this.tmpprio = 0;
			var expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
			var noperators = 0;
			var startPos = 0;
			this.expression = expr;
			this.pos = 0;
			this.startPos = 0;

			while (this.pos < this.expression.length) {
				this.startPos = this.pos;
				if (this.isOperator()) {
					if (this.isSign() && (expected & SIGN)) {
						if (this.isNegativeSign()) {
							this.tokenprio = 2;
							this.tokenindex = "-";
							noperators++;
							this.addfunc(tokenstack, operstack, TOP1);
						}
						expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
					}
					else if (this.isComment()) {

					}
					else {
						if ((expected & OPERATOR) === 0) {
							this.error_parsing(this.pos, "unexpected operator");
						}
						noperators += 2;
						this.addfunc(tokenstack, operstack, TOP2);
						expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
					}
				}
				else if (this.isColor()) {
					if ((expected & PRIMARY) === 0) {
						this.error_parsing(this.pos, "unexpected color");
					}
					// var token = new Token(TNUMBER, 0, 0, this.tokennumber, this.tokenunit);
					var token = colorToken(this.tokennumber);
					tokenstack.push(this._saveRange(token));

					expected = (OPERATOR | RPAREN | COMMA);
				}
				else if (this.isNumber()) {
					if ((expected & PRIMARY) === 0) {
						this.error_parsing(this.pos, "unexpected number");
					}
					var token = new Token(TNUMBER, 0, 0, this.tokennumber, this.tokenunit);
					tokenstack.push(this._saveRange(token));

					expected = (OPERATOR | RPAREN | COMMA);
				}
				else if (this.isString()) {
					if ((expected & PRIMARY) === 0) {
						this.error_parsing(this.pos, "unexpected string");
					}
					var token = new Token(TNUMBER, 0, 0, this.tokennumber);
					tokenstack.push(this._saveRange(token));

					expected = (OPERATOR | RPAREN | COMMA);
				}
				else if (this.isLeftParenth()) {
					if ((expected & LPAREN) === 0) {
						this.error_parsing(this.pos, "unexpected \"(\"");
					}

					if (expected & CALL) {
						noperators += 2;
						this.tokenprio = -2;
						this.tokenindex = -1;
						this.addfunc(tokenstack, operstack, TFUNCALL);
					}

					expected = (PRIMARY | LPAREN | FUNCTION | SIGN | NULLARY_CALL);
				}
				else if (this.isRightParenth()) {
				    if (expected & NULLARY_CALL) {
						var token = new Token(TNUMBER, 0, 0, []);
						tokenstack.push(this._saveRange(token));
					}
					else if ((expected & RPAREN) === 0) {
						this.error_parsing(this.pos, "unexpected \")\"");
					}

					expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL);
				}
				else if (this.isComma()) {
					if ((expected & COMMA) === 0) {
						this.error_parsing(this.pos, "unexpected \",\"");
					}
					this.addfunc(tokenstack, operstack, TOP2);
					noperators += 2;
					expected = (PRIMARY | LPAREN | FUNCTION | SIGN);
				}
				else if (this.isConst()) {
					if ((expected & PRIMARY) === 0) {
						this.error_parsing(this.pos, "unexpected constant");
					}
					var consttoken = new Token(TNUMBER, 0, 0, this.tokennumber);
					tokenstack.push(this._saveRange(consttoken));
					expected = (OPERATOR | RPAREN | COMMA);
				}
				else if (this.isOp2()) {
					if ((expected & FUNCTION) === 0) {
						this.error_parsing(this.pos, "unexpected function");
					}
					this.addfunc(tokenstack, operstack, TOP2);
					noperators += 2;
					expected = (LPAREN);
				}
				else if (this.isOp1()) {
					if ((expected & FUNCTION) === 0) {
						this.error_parsing(this.pos, "unexpected function");
					}
					this.addfunc(tokenstack, operstack, TOP1);
					noperators++;
					expected = (LPAREN);
				}
				else if (this.isVar()) {
					if ((expected & PRIMARY) === 0) {
						this.error_parsing(this.pos, "unexpected variable");
					}
					var vartoken = new Token(TVAR, this.tokenindex, 0, 0);
					tokenstack.push(this._saveRange(vartoken));

					expected = (OPERATOR | RPAREN | COMMA | LPAREN | CALL);
				}
				else if (this.isWhite()) {
				}
				else {
					if (this.errormsg === "") {
						this.error_parsing(this.pos, "unknown character");
					}
					else {
						this.error_parsing(this.pos, this.errormsg);
					}
				}
			}
			if (this.tmpprio < 0 || this.tmpprio >= 10) {
				this.error_parsing(this.pos, "unmatched \"()\"");
			}
			while (operstack.length > 0) {
				var tmp = operstack.pop();
				tokenstack.push(tmp);
			}
			if (noperators + 1 !== tokenstack.length) {
				//print(noperators + 1);
				//print(tokenstack);
				this.error_parsing(this.pos, "parity");
			}

			console.log('old tokens', tokenstack);
			return new Expression(tokenstack, this.ops1, this.ops2, this.functions, expr);
		},

		evaluate: function (expr, variables) {
			return this.parse(expr).evaluate(variables);
		},

		error_parsing: function (column, msg) {
			this.success = false;
			this.errormsg = "parse error [column " + (column) + "]: " + msg;
			throw new Error(this.errormsg);
		},

//\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\

		addfunc: function (tokenstack, operstack, type_) {
			var operator = new Token(type_, this.tokenindex, this.tokenprio + this.tmpprio, 0);
			this._saveRange(operator);
			while (operstack.length > 0) {
				if (operator.prio_ <= operstack[operstack.length - 1].prio_) {
					tokenstack.push(operstack.pop());
				}
				else {
					break;
				}
			}
			operstack.push(operator);
		},

		_saveRange: function(token) {
			token._startPos = this.startPos;
			token._endPos = this.pos;
			return token;
		},

		isNumber: function () {
			var r = false;
			var str = "";
			this.tokenunit = '';
			while (this.pos < this.expression.length) {
				var code = this.expression.charCodeAt(this.pos);
				if ((code >= 48 && code <= 57) || code === 46) {
					str += this.expression.charAt(this.pos);
					this.pos++;
					this.tokennumber = parseFloat(str);
					r = true;
				}
				else if (str) {
					// parse unit value
					var ch = this.expression.charAt(this.pos);
					if (reUnit.test(ch)) {
						this.tokenunit += ch;
						this.pos++;
					} else {
						break;
					}
				}
				else {
					break;
				}
			}
			return r;
		},

		isColor: function () {
			var ch = this.expression.charAt(this.pos);
			if (ch != '#') {
				return false;
			}

			this.pos++;
			var str = "";
			var r = false;
			this.tokenunit = '#';
			while (this.pos < this.expression.length) {
				ch = this.expression.charAt(this.pos);
				if (reHexColorChar.test(ch)) {
					str += ch;
					r = true;
					this.pos++;
				} else {
					break;
				}
			}

			if (r) {
				if (str.length == 3 || str.length == 6) {
					this.tokennumber = colorMod.toDecimal(str);
				} else {
					this.error_parsing(this.pos, 'invalid color definition');
				}
			}

			return r;
		},

		// Ported from the yajjl JSON parser at http://code.google.com/p/yajjl/
		unescape: function(v, pos) {
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
						throw this.error_parsing(pos + i, "Illegal escape sequence: '\\" + c + "'");
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
		},

		isString: function () {
			var r = false;
			var str = "";
			var startpos = this.pos;
			if (this.pos < this.expression.length) {
				var ch = this.expression.charAt(this.pos);
				var inc = 1;
				if (ch == '~') {
					ch = this.expression.charAt(this.pos + 1);
					inc++;
				}

				if (ch !== '"' && ch !== "'") {
					return false;
				}

				this.pos += inc;
				while (this.pos < this.expression.length) {
					var code = this.expression.charAt(this.pos);
					if (code != ch || str.slice(-1) == "\\") {
						str += this.expression.charAt(this.pos);
						this.pos++;
					}
					else {
						this.pos++;
						this.tokennumber = this.unescape(str, startpos);
						r = true;
						break;
					}
				}
			}

			return r;
		},

		isConst: function () {
			var str;
			for (var i in this.consts) {
				if (true) {
					var L = i.length;
					str = this.expression.substr(this.pos, L);
					if (i === str) {
						this.tokennumber = this.consts[i];
						this.pos += L;
						return true;
					}
				}
			}
			return false;
		},

		isOperator: function () {
			var code = this.expression.charCodeAt(this.pos);
			if (code === 43) { // +
				this.tokenprio = 1;
				this.tokenindex = "+";
			}
			else if (code === 45) { // -
				// this is a tricky one: might be a dash before vendor-prefixed
				// property: -webkit-transform
				if (/[a-z]/i.test(this.expression.charAt(this.pos + 1))) {
					return false;
				}
				this.tokenprio = 1;
				this.tokenindex = "-";
			}
			else if (code === 124) { // |
				if (this.expression.charCodeAt(this.pos + 1) === 124) {
					this.pos++;
					this.tokenprio = 1;
					this.tokenindex = "||";
				}
				else {
					return false;
				}
			}
			else if (code === 42) { // *
				this.tokenprio = 2;
				this.tokenindex = "*";
			}
			else if (code === 47) { // /
				this.tokenprio = 3;
				this.tokenindex = "/";
			}
			else if (
				code == 33 /* ! */ ||
				code == 60 /* < */ ||
				code == 61 /* = */ ||
				code == 62 /* > */ 
				) {
				this.tokenprio = 0;
				this.tokenindex = String.fromCharCode(code);

				if (this.expression.charAt(this.pos + 1) == '=') {
					this.tokenindex += '=';
					this.pos++;
				}
			}
			// else if (code === 37) { // %
			// 	this.tokenprio = 2;
			// 	this.tokenindex = "%";
			// }
			// else if (code === 94) { // ^
			// 	this.tokenprio = 3;
			// 	this.tokenindex = "^";
			// }
			else {
				return false;
			}
			this.pos++;
			return true;
		},

		isSign: function () {
			var code = this.expression.charCodeAt(this.pos - 1);
			if (code === 45 || code === 43) { // -
				return true;
			}
			return false;
		},

		isPositiveSign: function () {
			var code = this.expression.charCodeAt(this.pos - 1);
			if (code === 43) { // -
				return true;
			}
			return false;
		},

		isNegativeSign: function () {
			var code = this.expression.charCodeAt(this.pos - 1);
			if (code === 45) { // -
				return true;
			}
			return false;
		},

		isLeftParenth: function () {
			var code = this.expression.charCodeAt(this.pos);
			if (code === 40) { // (
				this.pos++;
				this.tmpprio += 10;
				return true;
			}
			return false;
		},

		isRightParenth: function () {
			var code = this.expression.charCodeAt(this.pos);
			if (code === 41) { // )
				this.pos++;
				this.tmpprio -= 10;
				return true;
			}
			return false;
		},

		isComma: function () {
			var code = this.expression.charCodeAt(this.pos);
			if (code === 44) { // ,
				this.pos++;
				this.tokenprio = -1;
				this.tokenindex = ",";
				return true;
			}
			return false;
		},

		isWhite: function () {
			var code = this.expression.charCodeAt(this.pos);
			if (code === 32 || code === 9 || code === 10 || code === 13) {
				this.pos++;
				return true;
			}
			return false;
		},

		isOp1: function () {
			var str = "";
			for (var i = this.pos; i < this.expression.length; i++) {
				var c = this.expression.charAt(i);
				if (c.toUpperCase() === c.toLowerCase()) {
					if (i === this.pos || (c != '_' && (c < '0' || c > '9'))) {
						break;
					}
				}
				str += c;
			}
			if (str.length > 0 && (str in this.ops1)) {
				this.tokenindex = str;
				this.tokenprio = 5;
				this.pos += str.length;
				return true;
			}
			return false;
		},

		isOp2: function () {
			var str = "";
			for (var i = this.pos; i < this.expression.length; i++) {
				var c = this.expression.charAt(i);
				if (c.toUpperCase() === c.toLowerCase()) {
					if (i === this.pos || (c != '_' && (c < '0' || c > '9'))) {
						break;
					}
				}
				str += c;
			}
			if (str.length > 0 && (str in this.ops2)) {
				this.tokenindex = str;
				this.tokenprio = 5;
				this.pos += str.length;
				return true;
			}
			return false;
		},

		isVar: function () {
			var str = "", fc;
			for (var i = this.pos; i < this.expression.length; i++) {
				var c = this.expression.charAt(i);

				// @, $ and `-` are used for LESS and SCSS variables
				if (c != '@' && c != '$' && c != '-' && c != '%' && c.toUpperCase() === c.toLowerCase()) {
					if (i === this.pos || (c != '_' && (c < '0' || c > '9'))) {
						break;
					}
				}
				str += c;
			}
			if (str.length > 0) {
				this.tokenindex = str;
				this.tokenprio = 4;
				this.pos += str.length;
				return true;
			}
			return false;
		},

		isComment: function () {
			var code = this.expression.charCodeAt(this.pos - 1);
			if (code === 47 && this.expression.charCodeAt(this.pos) === 42) {
				this.pos = this.expression.indexOf("*/", this.pos) + 2;
				if (this.pos === 1) {
					this.pos = this.expression.length;
				}
				return true;
			}
			return false;
		}
	};

	return Parser;
});