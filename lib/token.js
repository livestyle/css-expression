/**
 * Description of token class. Token is a logical part of expression
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var TNUMBER  = 0;
	var TOP1     = 1;
	var TOP2     = 2;
	var TVAR     = 3;
	var TFUNCALL = 4;

	function Token(type, value, priority, stream) {
		this.type = type;
		this.value = value;
		this.priority = priority || 0;
		this.range = stream ? [stream.start, stream.pos] : null;
	}

	Token.prototype = {
		clone: function() {
			var clone = new Token();
			for (var p in this) if (this.hasOwnProperty(p)) {
				clone[p] = this[p];
			}
			return clone;
		},
		valueOf: function() {
			switch (this.type_) {
			case TNUMBER:
				if (isColorToken(this)) {
					return colorMod.toCSS(this.number_);
				}

				if (typeof this.number_ == 'string' || typeof this.number_ == 'boolean') {
					return this.number_;
				}

				return this.number_ + this.unit_;
			case TOP1:
			case TOP2:
			case TVAR:
				return this.index_;
			case TFUNCALL:
				return "CALL";
			default:
				return "Invalid Token";
			}
		},
		toString: function() {
			return this.valueOf();
		}
	};

	var out = function(stream, priority, type) {
		var value = (stream instanceof Token) ? stream.value : stream.current();
		return new Token(type || TNUMBER, value, priority);
	};

	out.string = function(stream, priority) {
		return out(stream, priority, TNUMBER);
	};

	out.number = function(stream, priority) {
		return out(stream, priority, TNUMBER);
	};

	out.variable = function(stream, priority) {
		return out(stream, priority, TVAR);
	};

	out.op1 = function(stream, priority) {
		return out(stream, priority, TOP1);
	};

	out.op2 = function(stream, priority) {
		return out(stream, priority, TOP2);
	};

	out.fn = function(stream, priority) {
		return out(stream, priority, TFUNCALL);
	};

	return module.exports = out;
});