/**
 * Expression execution context. Contains context variables
 * and functions. Preprocessors should inherit or implement
 * interface of this class and proivide custom logic for 
 * resolving variables via `get()` method
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	function Context(scope) {
		this._scope = scope || {};
	};

	Context.prototype = {
		get: function(name) {
			return this._scope[name];
		}
	};

	return Context;
});