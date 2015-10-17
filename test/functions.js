var assert = require('assert');
var e = require('../index');
var Context = require('../lib/context');

describe('Functions', function() {
	it('strings', function() {
		var ctx = new Context({
			'@q': '"string"',
			'@uq': 'string'
		});

		assert.equal(e('quote(hello)', ctx), '"hello"');
		assert.equal(e('quote("hello")', ctx), '"hello"');
		assert.equal(e('quote(@uq)', ctx), '"string"');
		assert.equal(e('quote(@q)', ctx), '"string"');

		assert.equal(e('unquote(hello)', ctx), 'hello');
		assert.equal(e('unquote("hello")', ctx), 'hello');
		assert.equal(e('unquote(@uq)', ctx), 'string');
		assert.equal(e('unquote(@q)', ctx), 'string');

		assert.equal(e('str-length(@q)', ctx), 6);		
		assert.equal(e('str-length(@uq)', ctx), 6);

		assert.equal(e('str-insert(abc, d, 1)', ctx), 'adbc');
		assert.equal(e('str-insert(abc, d, 0)', ctx), 'dabc');

		assert.equal(e('str-index("ababcd", ba)', ctx), 1);

		assert.equal(e('str-slice("abcd", 2)', ctx), '"cd"');
		assert.equal(e('str-slice(abcd, 2, 3)', ctx), 'c');

		assert.equal(e('to-upper-case(@q)', ctx), '"STRING"');
		assert.equal(e('to-lower-case(HELLO)', ctx), 'hello');
	});

	it('colors', function() {
		assert.equal(e('rgba(1,2,3,.5)'), 'rgba(1, 2, 3, 0.5)');
		assert.equal(e('rgba(red, 0.5)'), 'rgba(255, 0, 0, 0.5)');
		assert.equal(e('rgba(#fc0, 0.5)'), 'rgba(255, 204, 0, 0.5)');
		assert.equal(e('rgba(#fc0)'), '#ffcc00');
	});
});