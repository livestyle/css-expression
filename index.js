if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var parser = require('./lib/parser');
	var evaluator = require('./lib/evaluator');
	var patcher = require('./lib/patcher');
	var split = require('./lib/split');

	var reImportant = /\!important\s*$/;
	var reComplexValue = /[\(\+\-\*\/=<>\!\)@\$]/;
	
	var out = function(expr, context) {
		var important = '';
		if (reImportant.test(expr)) {
			expr = expr.replace(reImportant, '');
			important = ' !important';
		}

		if (!Array.isArray(expr)) {
			expr = split(expr);
		}

		var out = expr.map(function(part) {
			return reComplexValue.test(part) 
				? evaluator(part, context).valueOf()
				: part;
		});

		// respect output object type in case of single expression
		out = out.length > 1 ? out.join(' ') : out[0];
		if (important) {
			out += important;
		}

		return out;
	};

	out.eval = function(expr, context) {
		return evaluator(expr, context);
	};

	out.tokenize = function(expr) {
		return parser.parse(expr);
	};

	out.patch = function(expr, context, expected, actual) {
		return patcher.patch(expr, context, expected, actual);
	};

	out.split = split;

	return out;
});