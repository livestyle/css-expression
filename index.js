/**
 * JavaScript expression parser and evaluator, optimized for
 * CSS preprocessors
 * Based on https://github.com/silentmatt/js-expression-eval
 */
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
	var Context = require('./lib/context');

	var reImportant = /\!important\s*$/;

	var out = function(expr, context) {
		var important = '';
		if (reImportant.test(expr)) {
			expr = expr.replace(reImportant, '');
			important = ' !important';
		}

		var result = out.eval(expr, context).valueOf();

		// respect output object type in case of single expression
		if (important) {
			result += important;
		}

		return result;
	};

	out.eval = function(expr, context) { // jshint ignore:line
		context = Context.create(context);
		// preserve original expression in context
		if (typeof expr === 'string') {
			context._expression = expr;
		} else if (Array.isArray(expr) && expr.expression) {
			context._expression = expr.expression;
		}
		return evaluator(expr, context);
	};

	out.tokenize = function(expr) {
		return parser.parse(expr);
	};

	out.patch = function(expr, context, expected, actual) {
		return patcher.patch(expr, Context.create(context), expected, actual);
	};

	out.Context = Context;
	out.split = split;
	return out;
});