/**
 * Description of token class. Token is a logical part of expression
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var NUMBER   = 1;
	var OP1      = 2;
	var OP2      = 3;
	var VARIABLE = 4;
	var FUNCALL  = 5;
	var STRING   = 6;
	var BOOL     = 7;

	var reNumber = /^(-?[0-9\.]+)([a-z%]*)$/i;

	function cast(value, type) {
		if (value instanceof Token) {
			return value;
		}

		var out = {};
		if (typeof value === 'object' && 'current' in value) {
			out.range = [value.start, value.pos];
			value = value.current();
		}

		out.value = value;

		if (type === NUMBER && typeof value === 'string') {
			var m = value.match(reNumber);
			if (!m) {
				throw new Error('Unable to parse number token ' + value);
			}
			out.value = parseFloat(m[1]);
			if (isNaN(out.value)) {
				throw new Error('Invalid number "' + m[1] + '"');
			}

			out.unit = m[2] || '';
		}

		return out;
	}

	function Token(type, value, priority) {
		this.index = 0;
		this.unit = '';
		this.range = null;

		var casted = cast(value, type);
		var self = this;
		Object.keys(casted).forEach(function(key) {
			self[key] = casted[key];
		});

		this.type = type;
		if (typeof priority !== 'undefined' || !('priority' in this)) {
			this.priority = priority || 0;
		}
	}

	Token.prototype = {
		is: function(type) {
			if (typeof type == 'function') {
				return this.type === type._type;
			}
			return this.type === type;
		},
		clone: function() {
			return new Token(this.type, this);
		},
		valueOf: function() {
			return this.value;
			// switch (this.type_) {
			// case NUMBER:
			// 	if (isColorToken(this)) {
			// 		return colorMod.toCSS(this.number_);
			// 	}

			// 	if (typeof this.number_ == 'string' || typeof this.number_ == 'boolean') {
			// 		return this.number_;
			// 	}

			// 	return this.number_ + this.unit_;
			// case OP1:
			// case OP2:
			// case VARIABLE:
			// 	return this.index_;
			// case FUNCALL:
			// 	return "CALL";
			// default:
			// 	return "Invalid Token";
			// }
		},
		toString: function() {
			return this.valueOf();
		}
	};

	var out = function(value, priority, type) {
		return new Token(type || -1, value, priority);
	};

	var fndecorator = function(type) {
		var fn = function(stream, priority) {
			return out(stream, priority, type);
		};
		fn._type = type;
		return fn;
	};

	out.string   = fndecorator(STRING);
	out.number   = fndecorator(NUMBER);
	out.variable = fndecorator(VARIABLE);
	out.op1      = fndecorator(OP1);
	out.op2      = fndecorator(OP2);
	out.fn       = fndecorator(FUNCALL);
	out.bool     = fndecorator(BOOL);
	out.Token    = Token;

	return  out;
});