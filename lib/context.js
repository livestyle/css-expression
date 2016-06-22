/**
 * Expression execution context. Contains context variables
 * and functions. Authors should inherit or implement
 * interface of this class and provide custom logic for
 * resolving variables and functions via `variable()`
 * and `fn()` methods
 */
'use strict';

const functions = require('./functions');

module.exports = class Context {
	constructor(scope, logger) {
		this._scope = scope || {};
		this._expression = '';
		this.logger = logger;
	}

	static create(scope, logger) {
		if (scope instanceof Context) {
			return new Context(scope._scope, scope.logger);
		}

		return new Context(scope, logger);
	}

	variable(name) {
		if (name in this._scope && typeof this._scope[name] !== 'function') {
			return this._scope[name];
		}

		if (this.logger) {
			this.logger('Missing variable "' + name + '"', {
				type: 'variable',
				name: name
			});
		}

		return void 0;
	}

	fn(name) {
		var fn = this._scope[name];
		if (typeof fn === 'function') {
			return fn;
		}

		if (name in functions) {
			return functions[name];
		}

		if (this.logger && /^\w+/.test(name)) {
			this.logger('Missing function "' + name + '"', {
				type: 'function',
				name: name
			});
		}

		// check function in default set
		return void 0;
	}
}
