/**
 * Expression evaluator
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var tok = require('./token');
	var parser = require('./parser');
	var split = require('./split');

	var reComplexValue = /[\(\+\-\*\/=<>\!\)@\$,]/;

	/**
	 * Equality comparison: in case of numbers we have to check
	 * units as well
	 * @param  {Object} a     Primitive value of token `a`
	 * @param  {Object} b     Primitive value of token `b`
	 * @param  {Token} tokenA Token `a`
	 * @param  {Token} tokenB Token `b`
	 * @return {Token}        Boolean token
	 */
	var eqComparison = comparison(function(a, b, tokenA, tokenB) {
		if (tokenA.is(tok.number) && tokenB.is(tok.number) && (!tokenA.unit || !tokenB.unit)) {
			return a === b;
		}

		// in strings, do not check quotes
		if (tokenA.is(tok.string) && tokenB.is(tok.string) && tokenA.quote && tokenB.quote) {
			return a === b;
		}

		return tokenA.valueOf() === tokenB.valueOf();
	});

	var ops1 = {
		'-': function(a) {
			a = a.clone();
			a.value *= -1;
			return a;
		}
	};

	var ops2 = {
		'+':  operation(function(a, b) {return a + b;}),
		'-':  operation(function(a, b) {return a - b;}),
		'*':  operation(function(a, b) {return a * b;}),
		'/':  operation(function(a, b) {return a / b;}),
		'=':  eqComparison,
		'==': eqComparison,
		'<':  comparison(function(a, b) {return a < b;}),
		'>':  comparison(function(a, b) {return a > b;}),
		'<=': comparison(function(a, b) {return a <= b;}),
		'=<': comparison(function(a, b) {return a <= b;}),
		'>=': comparison(function(a, b) {return a >= b;}),
		'=>': comparison(function(a, b) {return a >= b;}),
		'!=': comparison(function(a, b) {return a != b;}),
		',':  function(a, b) {
			if (!a || !a.is(tok.list)) {
				a = tok.list(a ? [a] : []);
			}
			if (!b || !b.is(tok.list)) {
				b = tok.list(b ? [b] : []);
			}

			return tok.list(a.value.concat(b.value));
		}
	};

	function colorOperation(a, b, fn) {
		a = convertToColor(a);
		b = convertToColor(b);

		return tok.color(['r', 'g', 'b', 'a'].map(function(key) {
			return fn(a.value[key], b.value[key], a, b);
		}));
	}

	function operation(fn) {
		return function(a, b) {
			a = a || tok.number(0);
			b = b || tok.number(0);
			var c;

			// check if we're using color algebra:
			// cast number to color
			if (a.is(tok.color) || b.is(tok.color)) {
				return colorOperation(a, b, fn);
			}

			var c = a.clone();
			c.value = fn(a.toPrimitive(), b.toPrimitive(), a, b);
			c.unit = a.unit || b.unit;
			return c;
		};
	}

	function comparison(fn) {
		return function(a, b) {
			return tok.bool(fn(a.toPrimitive(), b.toPrimitive(), a, b));
		}
	}

	/**
	 * Converts given token to color
	 * @param  {Token} token
	 * @return {Token}
	 */
	function convertToColor(token) {
		if (token.is(tok.color)) {
			return token;
		}

		if (token.is(tok.number)) {
			return tok.color([token.value, token.value, token.value]);
		}

		return tok.color(token.value.valueOf());
	}

	function getOperation(token, context, fallback) {
		var op = token.value;
		return (context && context.fn(op)) || fallback[op];
	}

	/**
	 * Boxes given value into a token
	 * @param  {Object} value Value to box
	 * @return {Token} Value converted to required token
	 */
	function boxValue(value, context, guard) {
		if (typeof value === 'undefined' || value instanceof tok.Token) {
			return value;
		}

		if (typeof value === 'number') {
			return tok.number(value);
		}

		if (Array.isArray(value)) {
			return tok.list(value);
		}

		return evaluate(value, context, guard); 
	}

	function sanitizeArgs(args) {
		return args.filter(function(arg) {
			return arg !== parser.nullary;
		});
	}

	function runFn(fn, argToken, context, guard) {
		var args = argToken.is(tok.list) ? argToken.value : [argToken];
		return boxValue(fn.apply(null, sanitizeArgs(args)), context, guard);
	}

	function getVariable(token, context, guard) {
		if (~guard.indexOf(token.value)) {
			throw new Error('Recursive variable reference: ' + token.value);
		}
		guard.push(token.value);
		return boxValue(context.variable(token.value), context, guard);
	}

	function convertToString(fnToken, argToken) {
		var args = argToken.is(tok.list) ? argToken.value : [argToken];
		return tok.string(fnToken.value + '(' + sanitizeArgs(args).map(function(a) {
			return a.value.valueOf()
		}).join(', ') + ')');
	}

	function evaluatePart(expr, context, guard) {
		if (!Array.isArray(expr)) {
			expr = parser.parse(expr);
		}

		var nstack = [];
		var n1, n2, f;
		var item, value;

		for (var i = 0, il = expr.length; i < il; i++) {
			item = expr[i];
			if (item.is(tok.op2)) {
				n2 = nstack.pop();
				n1 = nstack.pop();
				f = getOperation(item, context, ops2);
				nstack.push(f(n1, n2));
			} else if (item.is(tok.variable)) {
				value = getVariable(item, context, guard || []);
				if (value === void 0) {
					// maybe it's a function call?
					value = item;
				}

				nstack.push(value);
			} else if (item.is(tok.op1)) {
				n1 = nstack.pop();
				f = ops1[item.value];
				nstack.push(f(n1));
			} else if (item.is(tok.fn)) {
				n1 = nstack.pop();
				n2 = nstack.pop();
				f = context.fn(n2.value);
				if (f) {
					value = runFn(f, n1, context, guard || []);
					if (value !== null) {
						nstack.push(value);
						continue;
					}
				} 

				// if we are here then function either doesn't exists or 
				// returnes `null` (which are equivalent)
				// in this case, convert it to string expression
				nstack.push(convertToString(n2, n1));
			} else {
				nstack.push(item);
				// throw new Error("Invalid expression");
			}
		}

		if (nstack.length > 1) {
			throw new Error('Invalid Expression (parity)');
		}

		return nstack[0];
	}

	function evaluate(expr, context, guard) {
		if (Array.isArray(expr)) {
			return evaluatePart(expr, context, guard);
		}

		var out = split(expr + '').map(function(part) {
			return reComplexValue.test(part) 
				? evaluatePart(part, context, guard)
				: parser.parse(part)[0];
		});

		return out.length == 1 ? out[0] : tok.string(out.join(' '));
	}

	return evaluate;
});