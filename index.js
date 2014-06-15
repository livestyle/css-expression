var parser = require('./lib/parser');
var evaluator = require('./lib/evaluator');
var patcher = require('./lib/patcher');

module.exports = function(expr, context) {
	return evaluator(expr, context).valueOf();
};

module.exports.eval = function(expr, context) {
	return evaluator(expr, context);
};

module.exports.tokenize = function(expr) {
	return parser.parse(expr);
};

module.exports.patch = function(expr, value) {
	return patcher.patch(expr, value);
};