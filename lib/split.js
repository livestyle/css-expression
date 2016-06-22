/**
 * Splits complex CSS value by space. For example,
 * `5px 10em 40%` will be splitted on `['5px', '10em', '40%'].
 * This method understands expression formatting so it won’t break
 * expressions
 */
'use strict';

const stringStream = require('./string-stream');

const reSpace = /[\s\u00a0]/;
const reOps =  /[\-\+\*\/,=\!<>]/;

module.exports = function(expr) {
	expr = expr.trim();

	if (!reSpace.test(expr)) {
		return [expr];
	}

	var stream = stringStream(expr);
	var parts = [], ch;

	while (ch = stream.next()) {
		if (reSpace.test(ch)) {
			// found space, it could be a part separator or
			// just an expression formatting
			stream.eatSpace();
			if (reOps.test(stream.peek())) {
				// found operator: it’s a formatting
				stream.next();
				while (stream.next() === '=') {}
				stream.eatSpace();
			} else {
				// it’s a part separator
				parts.push(stream.current().trim());
				stream.start = stream.pos;
			}
		} else if (ch == ',') {
			stream.eatSpace();
		} else if (ch == '(') {
			stream.backUp(1);
			stream.skipToPair('(', ')');
		} else {
			stream.skipQuoted();
		}
	}

	parts.push(stream.current().trim());
	
	return parts.filter(Boolean);
};
