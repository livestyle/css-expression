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
	var functions = require('./functions');
	function Context(scope) {
		this._scope = scope || {};
	};

	Context.prototype = {
		variable: function(name) {
			var obj = this._scope[name];
			return typeof obj !== 'function' ? obj : void 0;
		},
		fn: function(name) {
			var fn = this._scope[name];	
			if (typeof fn === 'function') {
				return fn;
			}

			// check function in default set
			return functions[name] || void 0;
		}
	};

	Context.create = function(scope) {
		scope = scope || {};
		if (scope instanceof Context) {
			return scope;
		}
		
		return new Context(scope);
	};

	return Context;
});