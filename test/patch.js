var assert = require('assert');
var patcher = require('../lib/patcher');
var parser = require('../lib/parser');
var Context = require('../lib/context');

describe('Expression Patcher', function() {
	it('find safe token', function() {
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

	it('modify safe token', function() {
		var r = function(expr, replacement) {
			return patcher.replaceSafeToken(expr, replacement);
		};

		// single value
		assert.equal(r('1px', '2px'), '2px');
		assert.equal(r('-1px', '2px'), '2px');
		assert.equal(r('#fc0', 'red'), 'red');

		// unknown token, can’t be safe
		assert.equal(r('foo', 'red'), null);
		
		assert.equal(r('1 + 2', '3'), '1 + 3');
		assert.equal(r('1 + 2 - 3', '-4'), '1 + 2 - 4');
		assert.equal(r('1 + 2 - a', '10'), '1 + 10 - a');
		assert.equal(r('1 - a', '5'), '5 - a');
		assert.equal(r('(1 - a)', '5'), '(5 - a)');
		assert.equal(r('(1 - a) + 2', '100'), '(1 - a) + 100');
		assert.equal(r('(1 - a) + b', '200'), '(200 - a) + b');
		assert.equal(r('c(1 - a) + 2', '3'), 'c(1 - a) + 3');
		assert.equal(r('c(1 - a) + 2 - b(3)', '4'), 'c(1 - a) + 4 - b(3)');
		assert.equal(r('c(1 - a) + 2 - b(3/2)', '5'), 'c(1 - a) + 5 - b(3/2)');
		assert.equal(r('c(1 - a) + 2 - b(3/2, 8)', '5'), 'c(1 - a) + 5 - b(3/2, 8)');

		// work with sign change
		assert.equal(r('1 + 2', '-2'), '1 - 2');
		assert.equal(r('1 - 2', '3'), '1 + 3');
		assert.equal(r('1 - a', '3'), '3 - a');
		assert.equal(r('1 - a', '-3'), '-3 - a');
		assert.equal(r('1 + a', '-3'), '-3 + a');
		assert.equal(r('-1 + a', '-3'), '-3 + a');
		assert.equal(r('-1 + a', '3'), '3 + a');

		// replace with zero
		assert.equal(r('1 + 2', '0'), '1');
		assert.equal(r('1 - 2', '0'), '1');
		assert.equal(r('a + 2', '0'), 'a');
		assert.equal(r('1 + a', '0'), 'a');
		assert.equal(r('-1 + a', '0'), 'a');
		assert.equal(r('-1 - a', '0'), '-a');

		// work with colors
		assert.equal(r('#fff + a', '#bc3'), '#bc3 + a');
		assert.equal(r('a + #fff', '#bc3'), 'a + #bc3');
		assert.equal(r('a + #fff', '-#bc3'), 'a - #bc3');
	});

	it('modify expression', function() {
		var ctx = new Context({a: 10, b: 11, c: 12, $a: '100px'});
		var p = function(expr, expected) {
			var result = patcher.patch(expr, ctx, expected);
			return result ? result.expression : undefined;
		};

		assert.equal(p('a', 10), 'a'); // no change: results are equal
		assert.equal(p('a', 11), 'a + 1');
		assert.equal(p('a + 1', 12), 'a + 2');
		assert.equal(p('a + b', 22), 'a + b + 1');
		assert.equal(p('$a - 50px', '10px'), '$a - 90px');
		
		assert.equal(p('a + 3px', '9px'), 'a - 1px');
		assert.equal(p('a + 3px', '9em'), '9em'); // unit mismatch, replace value
		assert.equal(p('a + 3px', '#000013'), '#000013'); // type mismatch, replace value
		assert.equal(p('#fc0', 'rgba(255, 127, 9, 0.5)'), 'rgba(255, 127, 9, 0.5)');
	});

	it('patch color', function() {
		var ctx = new Context({'$main-color': '#000'});
		var p = function(expr, expected) {
			var result = patcher.patch(expr, ctx, expected);
			return result ? result.expression : undefined;
		};

		assert.equal(p('$main-color', '#ccc'), '$main-color + #cccccc');
		assert.equal(p('$main-color + #cccccc', '#111'), '$main-color + #111111');
	});
});