/**
 * Description of token class. Token is a logical part of expression
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var color = require('./color');
	var stringStream = require('string-stream');

	var NUMBER   = 1;
	var OP1      = 2;
	var OP2      = 3;
	var VARIABLE = 4;
	var FUNCALL  = 5;
	var STRING   = 6;
	var BOOL     = 7;
	var COLOR    = 8;
	var LIST     = 9;
	var SPACE    = 10;

	var reNumber = /^(-?[0-9\.]+)([a-z%]*)$/i;

	/**
	 * Strips quotes from given string, if required
	 * @param  {String} str
	 * @return {Object}     Object with `quote` and `string` values
	 */
	function unquote(str) {
		var quote = '';
		var clean = str;

		// make sure this quote wraps whole string
		var stream = stringStream(str);
		if (stream.skipQuoted(true) && stream.pos === str.length) {
			quote = str[0];
			clean = clean.substring(1, clean.length - 1);
		}

		return {
			quote: quote,
			string: clean
		};
	}

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
		} else if (type === COLOR) {
			out.value = color(value);
		} else if (type === STRING) {
			// unquote string
			var q = unquote(value);
			out.value = q.string;
			out.quote = q.quote;
		} else if (type === LIST && !Array.isArray(value)) {
			out.value = [value];
		}

		return out;
	}

	function Token(type, value, priority) {
		this.unit = '';
		this.quote = '';
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
		valueOf: function(glue) {
			switch (this.type) {
				case STRING:
					return this.quote + this.value + this.quote;
				case COLOR:
					return this.value.valueOf();
				case LIST:
					return this.value.map(function(item) {
						return item.valueOf();
					}).join(glue || this.value.glue || ', ');
				case NUMBER:
					var value = this.value.toFixed(15).replace(/0+$/, '').replace(/\.$/, '');
					return value + this.unit;
			}
			return this.value;
		},
		toString: function() {
			return this.valueOf();
		},
		/**
		 * Returns a primitive token value: value that can be used
		 * internally for comparisons
		 * @return {Object}
		 */
		toPrimitive: function() {
			if (this.type === COLOR) {
				return this.value.toDecimal();
			}

			return this.value;
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
	out.color    = fndecorator(COLOR);
	out.list     = fndecorator(LIST);
	out.space    = fndecorator(SPACE);
	out.Token    = Token;

	return  out;
});