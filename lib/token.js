/**
 * Description of token class. Token is a logical part of expression
 */
'use strict';

const color = require('./color');
const stringStream = require('./string-stream');

const NUMBER   = 1;
const OP1      = 2;
const OP2      = 3;
const VARIABLE = 4;
const FUNCALL  = 5;
const STRING   = 6;
const BOOL     = 7;
const COLOR    = 8;
const LIST     = 9;
const SPACE    = 10;

const reNumber = /^(-?[0-9\.]+)([a-z%]*)$/i;

module.exports = function(value, priority, type) {
	return new Token(type || -1, value, priority);
};

module.exports.string   = fndecorator(STRING);
module.exports.number   = fndecorator(NUMBER);
module.exports.variable = fndecorator(VARIABLE);
module.exports.op1      = fndecorator(OP1);
module.exports.op2      = fndecorator(OP2);
module.exports.fn       = fndecorator(FUNCALL);
module.exports.bool     = fndecorator(BOOL);
module.exports.color    = fndecorator(COLOR);
module.exports.list     = fndecorator(LIST);
module.exports.space    = fndecorator(SPACE);
module.exports.restore  = function(obj) {
	var token = module.exports(obj.value, obj.priority, obj.type);
	['unit', 'quote', 'range'].forEach(function(key) {
		if (key in obj) {
			token[key] = obj[key];
		}
	});
	return token;
};

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
	if (value && typeof value === 'object' && 'current' in value) {
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

class Token {
	constructor(type, value, priority) {
		this.unit = '';
		this.quote = '';
		this.range = null;

		var casted = cast(value, type);
		Object.keys(casted).forEach(key => this[key] = casted[key]);

		this.type = type;
		if (priority != null || !('priority' in this)) {
			this.priority = priority || 0;
		}
	}

	is(type) {
		if (typeof type == 'function') {
			return this.type === type._type;
		}
		return this.type === type;
	}

	clone() {
		return new Token(this.type, this);
	}

	valueOf(glue) {
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
	}

	toString() {
		return this.valueOf();
	}

	/**
	 * Returns a primitive token value: value that can be used
	 * internally for comparisons
	 * @return {Object}
	 */
	toPrimitive() {
		if (this.type === COLOR) {
			return this.value.toDecimal();
		}

		return this.value;
	}
};

module.exports.Token = Token;

function fndecorator(type) {
	var fn = function(stream, priority) {
		return module.exports(stream, priority, type);
	};
	fn._type = type;
	return fn;
}
