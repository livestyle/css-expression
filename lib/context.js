/**
 * Expression execution context. Contains context variables
 * and functions. Authors should inherit or implement
 * interface of this class and proivide custom logic for 
 * resolving variables and functions via `variable()` 
 * and `fn()` methods
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var functions = require('./functions');
	function Context(scope, logger) {
		this._scope = scope || {};
		this.logger = logger;
	};

	Context.prototype = {
		variable: function(name) {
			if (name in this._scope && typeof this._scope[name] !== 'function') {
				return this._scope[name];
			}

			if (this.logger) {
				this.logger('Missing variable "' + name + '"');
			}

			return void 0;
		},
		fn: function(name) {
			var fn = this._scope[name];	
			if (typeof fn === 'function') {
				return fn;
			}

			if (name in functions) {
				return functions[name];
			}

			if (this.logger && /^\w+/.test(name)) {
				this.logger('Missing function " ' + name + '"');
			}

			// check function in default set
			return void 0;
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