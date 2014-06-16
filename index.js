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
	
	var out = function(expr, context) {
		return evaluator(expr, context).valueOf();
	};

	out.eval = function(expr, context) {
		return evaluator(expr, context);
	};

	out.tokenize = function(expr) {
		return parser.parse(expr);
	};

	out.patch = function(expr, value) {
		return patcher.patch(expr, value);
	};

	return out;
});