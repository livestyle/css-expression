if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

/**
 * Patcher: a set of methods to locate and modify a "safe token" in expression.
 * A "safe token" is a NUMBER token added or removed from whole expression.
 * This token can be safely modified so whole expression will return expected result
 */
define(function(require, exports, module) {
	var tok = require('./token');
	var color = require('./color');
	var parser = require('./parser');


	var complexVar = {};

	function isCandidate(item) {
		return item && '__bad' in item;
	}

	function isComplexVar(item) {
		if (item === complexVar || isCandidate(item)) {
			return true;
		}

		if (item.is(tok.variable)) {
			// check if this keyword can be converted to color
			return !convertToColor(item);
		}

		return false;
	}

	function bad(item) {
		if (isCandidate(item)) {
			item.__bad = true;
		}
		return item;
	}

	function convertToColor(token) {
		return token ? color(token.valueOf(), true) : null;
	}

	function pickBestCandidate(candidates) {
		candidates = candidates.filter(function(item) {
			return !item.__bad;
		});


		var c, _color;
		while (candidates.length) {
			c = candidates.pop();
			if (c.value.is(tok.number) || c.value.is(tok.color)) {
				return c;
			}

			if (c.value.is(tok.variable)) {
				// could be either a variable of a color keyword
				_color = convertToColor(c.value);
				if (_color) {
					_color.range = c.value.range;
					c.value = _color;
					return c;
				}
			}
		}
	}

	function replaceSubstring(string, value, from, to) {
		if (string !== null && typeof string !== 'undefined') {
			if (from instanceof tok.Token) {
				to = from.range[1];
				from = from.range[0];
			}

			return string.substring(0, from)
				+ value 
				+ string.substring(to);
		}
	}

	function SafeToken(value, op, side) {
		this.__bad = false;
		this.value = value;
		this.op = op;
		this.side = side;
	}

	SafeToken.prototype.valueOf = function() {
		var result = this.value.valueOf();
		if (this.value.is(tok.color)) {
			// it’s a color
			result = this.value.value.toDecimal();
		}
		
		if (this.side == 'right' && this.op.value === '-') {
			result *= -1;
		}

		return result;
	};

	return {
		/**
		 * Safe token is a TNUMBER token that added or substracted
		 * from expression. This token can be safely modified
		 * to produce new expression with expected value
		 * @return {Object} Object with `value` and `op` tokens
		 */
		findSafeToken: function(tokens) {
			var nstack = [];
			var n1, n2, c;
			var item, out, side;
			var candidates = [];

			for (var i = 0, il = tokens.length, item; i < il; i++) {
				item = tokens[i];
				if (item.is(tok.number) || item.is(tok.color)) {
					nstack.push(item);
				} else if (item.is(tok.op2)) {
					n2 = nstack.pop();
					n1 = nstack.pop();
					side = null;
					out = null;

					if (item.value !== '+' && item.value !== '-') {
						bad(n1);
						bad(n2);
						nstack.push(complexVar);
						continue;
					}

					if (!isComplexVar(n2)) {
						out = n2;
						side = 'right';
					} else if (!isComplexVar(n1)) {
						out = n1;
						side = 'left';
					}

					if (out) {
						c = new SafeToken(out, item, side);
						candidates.push(c);
						nstack.push(c);
					} else {
						nstack.push(complexVar);
					}
				} else if (item.is(tok.variable)) {
					nstack.push(item);
				} else if (item.is(tok.op1)) {
					out = nstack.pop();
					if (out.is(tok.number)) {
						out = out.clone();
						out.value *= -1;
						if (out.range && item.range) {
							out.range[0] = item.range[0];
						}
						nstack.push(out);
					} else {
						nstack.push(complexVar);
					}
				} else if (item.is(tok.fn)) {
					bad(nstack.pop());
					nstack.pop();
					nstack.push(complexVar);
				}
			}

			if (!candidates.length && nstack.length === 1) {
				// looks like this expression consists of a single value
				var t = nstack[0];
				if (t.is(tok.number) || t.is(tok.color) || t.is(tok.variable)) {
					c = new SafeToken(nstack[0], null, 'left');
					c.single = true;
					candidates.push(c);
				}
			}

			return pickBestCandidate(candidates);
		},

		patch: function(expr, value) {
			var tokens;
			if (Array.isArray(expr)) {
				tokens = expr;
				expr = tokens.expression;
			} else {
				tokens = parser.parse(expr);
			}


			var safe = this.findSafeToken(tokens);
			if (!safe) {
				return null;
			}
			
			var rt = function(value, from, to) {
				expr = replaceSubstring(expr, value, from, to);
			};

			if (!value || value == '0') {
				// replacing with zero: remove operand and operation sign
				if (safe.side == 'right') {
					rt('', safe.op.range[0], safe.value.range[1]);
				} else {
					if (safe.op && safe.op.value === '+') {
						rt('', safe.op);
					}
					
					rt('', safe.value);
				}

				return expr.trim().replace(/^-\s+/, '-');
			}

			// do we have to change the sign of safe token?
			var isValueNegative = value[0] === '-';
			var isSafeNegative = safe.side === 'right' ? safe.op.value === '-' : safe.value < 0;
			if (isValueNegative !== isSafeNegative) {
				// we have to change token value sign
				if (safe.side === 'right') {
					// safe token is on the right side of expression,
					// change sign of operation token
					safe.op.value = isSafeNegative ? '+' : '-';
					if (isValueNegative) {
						value = value.substr(1);
					}
					rt(safe.op.value, safe.op);
				}
			} else if (isValueNegative && safe.side === 'right') {
				value = value.substr(1);
			}

			rt(value, safe.value);
			
			return expr;
		}
	};
});