/**
 * Expression evaluator
 */
'use strict';

const tok = require('./token');
const parser = require('./parser');

/**
 * Equality comparison: in case of numbers we have to check
 * units as well
 * @param  {Object} a     Primitive value of token `a`
 * @param  {Object} b     Primitive value of token `b`
 * @param  {Token} tokenA Token `a`
 * @param  {Token} tokenB Token `b`
 * @return {Token}        Boolean token
 */
const eqComparison = comparison(function(a, b, tokenA, tokenB) {
	if (tokenA.is(tok.number) && tokenB.is(tok.number) && (!tokenA.unit || !tokenB.unit)) {
		return a === b;
	}

	// in strings, do not check quotes
	if (tokenA.is(tok.string) && tokenB.is(tok.string) && tokenA.quote && tokenB.quote) {
		return a === b;
	}

	return tokenA.valueOf() === tokenB.valueOf();
});

const ops1 = {
	'-': function(a) {
		a = a.clone();
		a.value *= -1;
		return a;
	}
};

const ops2 = {
	'+':  operation(function(a, b) {return a + b;}),
	'-':  operation(function(a, b) {return a - b;}),
	'*':  operation(function(a, b) {return a * b;}),
	'/':  operation(function(a, b) {return a / b;}, '/'),
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
		var arr = [];
		if (a) {
			if (!a.is(tok.list) || a.value.glue === ' ') {
				arr.push(a);
			} else {
				arr = arr.concat(a.value);
			}
		}

		if (b) {
			if (!b.is(tok.list) || b.value.glue === ' ') {
				arr.push(b);
			} else {
				arr = arr.concat(b.value);
			}
		}

		return tok.list(arr);
	}
};

var evaluate = module.exports = function(expr, context, guard) {
	if (typeof expr === 'string') {
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
			nstack.push(f.call(context, n1, n2));
		} else if (item.is(tok.variable)) {
			value = getVariable(item, context, guard.slice(0));
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
				value = runFn(f, n1, context, guard.slice(0));
				if (value !== null) {
					nstack.push(value);
					continue;
				}
			}

			// if we are here then function either doesn't exists or
			// returnes `null` (which are equivalent)
			// in this case, convert it to string expression
			nstack.push(convertToString(n2, n1));
		} else if (item.is(tok.space)) {
			n2 = nstack.pop();
			n1 = nstack.pop();
			nstack.push(spaceOperator(n1, n2));
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

function colorOperation(a, b, fn) {
	a = convertToColor(a);
	b = convertToColor(b);
	var comps = ['r', 'g', 'b'];
	// do not operate on alpha component if values are equal in both
	// colors, otherwise it produces invalid result,
	// e.g. `#000 - #ccc = rgba(204, 204, 204, 0)`
	if (a.a !== a.b) {
		comps.push('a');
	}

	return tok.color(comps.map(function(key) {
		return fn(a.value[key], b.value[key], a, b);
	}));
}

function operation(fn, magic) {
	return function(a, b) {
		a = a || tok.number(0);
		b = b || tok.number(0);


		if (magic === '/') {
			var magicResult = magicDivide(a, b, this);
			if (magicResult !== null) {
				return magicResult;
			}
		}

		// check if we're using color algebra:
		// cast number to color
		if (a.is(tok.color) || b.is(tok.color)) {
			return colorOperation(a, b, fn);
		}

		var c = a.clone();
		c.value = fn(a.toPrimitive(), b.toPrimitive(), a, b);
		if (isNaN(c.value)) {
			throw new Error('Expression evaluated to NaN');
		}
		if (typeof c.value === 'string' && !c.is(tok.string)) {
			// looks like a type coersion (e.g. num + string = string),
			// make sure returned token is a string
			return tok.string(c.value);
		}
		c.unit = a.unit || b.unit;
		return c;
	};
}

/**
 * A special case of `/` operator. In CSS it’s perfectly valid to write
 * CSS property like `font: 28px/35px;`, which conflicts with division
 * operator. In LESS, `28px/35px` expression acts as concatenation for
 * `font` property only. In SCSS, the same expression is not calculated
 * all the time, except when parts of expression are not variables.
 * To handle these differences, we will rely on some magic context
 * variables
 * @param  {Token} a
 * @param  {Token} b
 * @param  {Context} ctx
 * @return {Token} Returns `null` if “magic” requirements were not met
 * and we should continue with standard operation
 */
function magicDivide(a, b, ctx) {
	var magicMode = ctx.variable('%magic-div');
	var concat = false;
	var noSpaces = a.range[1] === b.range[0] - 1;
	if (magicMode === 1) {
		// mode 1: always concat values if there are no spaces around `/`
		concat = noSpaces;
	} else if (magicMode === 2) {
		// mode 2: same as mode 1 but using plain values (e.g. no variables)
		concat = noSpaces && isPlainValue(a, ctx) && isPlainValue(b, ctx);
	}

	return concat ? tok.string(a.valueOf() + '/' + b.valueOf()) : null;
}

function isPlainValue(token, ctx) {
	var expr = ctx._expression || '';
	var r = token.range || [];
	return r.length && expr.slice(r[0], r[1]) == token.valueOf();
}

function comparison(fn) {
	return function(a, b) {
		return tok.bool(fn(a.toPrimitive(), b.toPrimitive(), a, b));
	};
}

function spaceOperator(a, b) {
	var val = function(token) {
		return token.is(tok.list) ? token.value : token;
	};
	var c = tok.list([].concat(val(a), val(b)));
	c.value.glue = ' ';
	return c;
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
	if (value == null || value instanceof tok.Token) {
		return value;
	}

	if (typeof value === 'object' && 'unit' in value) {
		// a serialized token
		return tok.restore(value);
	}

	if (typeof value === 'number') {
		return tok.number(value);
	}

	if (typeof value === 'boolean') {
		return tok.bool(value);
	}

	if (Array.isArray(value)) {
		return tok.list(value);
	}

	try {
		return evaluate(value, context, guard);
	} catch (e) {
		return tok.string(value);
	}
}

function sanitizeArgs(args) {
	return args.filter(function(arg) {
		return arg !== parser.nullary;
	});
}

function resolveArgs(args, context, guard) {
	return args.map(function(a) {
		if (a.is(tok.variable)) {
			return getVariable(a, context, guard.slice(0)) || a;
		}
		return a;
	});
}

function runFn(fn, args, context, guard) {
	if (!args.is(tok.list)) {
		args = [args];
	} else if (args.value.glue === ' ') {
		args = [tok.string(args.valueOf())];
	} else {
		args = args.value;
	}

	args = resolveArgs(sanitizeArgs(args), context, guard);
	return boxValue(fn.apply(context, args), context, guard);
}

function getVariable(token, context, guard) {
	if (~guard.indexOf(token.value)) {
		throw new Error('Recursive variable reference: ' + token.value);
	}
	guard.push(token.value);
	var v = boxValue(context.variable(token.value), context, guard);
	if (v) {
		// keep token range to properly handle some special cases
		v.range = token.range;
	}
	return v;
}

function convertToString(fnToken, argToken) {
	// var args = argToken.is(tok.list) ? argToken.value : [argToken];
	var args = [argToken];
	return tok.string(fnToken.value + '(' + sanitizeArgs(args).map(function(a) {
		return a.valueOf();
	}).join(', ') + ')');
}
