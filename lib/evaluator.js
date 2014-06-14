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
		'=':  comparison(function(a, b) {return a == b;}),
		'==': comparison(function(a, b) {return a == b;}),
		'<':  comparison(function(a, b) {return a < b;}),
		'>':  comparison(function(a, b) {return a > b;}),
		'<=': comparison(function(a, b) {return a <= b;}),
		'>=': comparison(function(a, b) {return a <= b;}),
		'!=': comparison(function(a, b) {return a != b;}),
		',':  function(a, b) {
			if (!a || !a.is(tok.list)) {
				a = tok.list(a ? a.value : []);
			}
			if (!b || !b.is(tok.list)) {
				b = tok.list(b ? b.value : []);
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

	function runFn(fn, argToken, context, guard) {
		var args = argToken.is(tok.list) ? argToken.value : [argToken.value];
		return boxValue(fn.apply(null, args), context, guard);
	}

	function getVariable(token, context, guard) {
		if (~guard.indexOf(token.value)) {
			throw new Error('Recursive variable reference: ' + token.value);
		}
		guard.push(token.value);
		return boxValue(context.variable(token.value), context, guard);
	}

	function evaluate(expr, context, guard) {
		if (!Array.isArray(expr)) {
			expr = parser.parse(expr);
		}

		guard = guard || [];

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
				value = getVariable(item, context, guard);
				if (value === void 0) {
					throw new Error('Undefined variable: ' + item.value);
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
					value = runFn(f, n1, context, guard);
					if (value === null) {
						throw new Error('Function "' + n2.value + '" returned null');
					}
					nstack.push(value);
				} else {
					throw new Error('Function "' + n2.value + '" doesn’t exists');
				}
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

	return evaluate;
});