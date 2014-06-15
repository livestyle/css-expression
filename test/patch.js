var assert = require('assert');
var patcher = require('../lib/patcher');
var parser = require('../lib/parser');
var Context = require('../lib/context');

describe('Expression Patcher', function() {
	it('should find safe token', function() {
		var ctx = new Context({a: 10, b: 11, c: 12});
		var t = function(expr) {
			var safeToken = patcher.findSafeToken(parser.parse(expr));
			if (safeToken) {
				return (safeToken.side == 'right' ? safeToken.op.value : '') + safeToken.value.valueOf();
			}
		};

		var v = function(expr) {
			var safeToken = patcher.findSafeToken(parser.parse(expr));
			return safeToken ? safeToken.valueOf() : void 0;
		};

		assert.equal(t('1'), '1');
		assert.equal(t('-1'), '-1');
		assert.equal(t('#fc0'), '#ffcc00');
		
		assert.equal(t('1 + 2'), '+2');
		assert.equal(t('1 + 2 - 3'), '-3');
		assert.equal(t('1 + 2 - a'), '+2');
		assert.equal(t('1 - a'), '1');
		assert.equal(t('-1 - a'), '-1');
		assert.equal(t('(1 - a) + 2'), '+2');
		assert.equal(t('(1 - a) + b'), '1');
		assert.equal(t('(1 - a) / b'), undefined);
		assert.equal(t('c(1 - a)'), undefined);
		assert.equal(t('c(1 - a) + 2'), '+2');
		assert.equal(t('c(1 - a) + 2 - b(3)'), '+2');
		assert.equal(t('c(1 - a) + 2 - b(3/2)'), '+2');
		assert.equal(t('#fff + a'), '#ffffff');

		// test numeric value
		assert.equal(v('1 + 2'), 2);
		assert.equal(v('1 + 2 - 3'), -3);
		assert.equal(v('1 - a'), 1);
		assert.equal(v('-1 - a'), -1);
		assert.equal(v('#000'), 0);
		assert.equal(v('#010'), parseInt('11', 16) << 8);
	});
});