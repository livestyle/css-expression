var assert = require('assert');
var e = require('../index');

describe('CSS Expression', function() {
	it('should evaluate simple math expressions', function() {
		assert.equal(e('1+2'), 3);
		assert.equal(e('1 + 2'), 3);
		assert.equal(e('1 - 2'), -1);
		assert.equal(e('1 + 2 * 3'), 7);
		assert.equal(e('(1 + 2) * 3'), 9);
		assert.equal(e('((1 + 2) * 3) / 9'), 1);
		assert.equal(e('-3 + 2'), -1);
		assert.equal(e('6 / -2'), -3);
	});
});