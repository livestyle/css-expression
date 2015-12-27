var assert = require('assert');
var e = require('../index');
var Context = require('../lib/context');

describe('CSS Expression', function() {
	it('simple math', function() {
		assert.equal(e('1+2'), 3);
		assert.equal(e('1 + 2'), 3);
		assert.equal(e('1 - 2'), -1);
		assert.equal(e('100 + 12'), 112);
		assert.equal(e('1 + 2 * 3'), 7);
		assert.equal(e('(1 + 2) * 3'), 9);
		assert.equal(e('((1 + 2) * 3) / 9'), 1);
		assert.equal(e('-3 + 2'), -1);
		assert.equal(e('6 / -2'), -3);
		assert.equal(e('6/-2'), -3);

		assert.equal(e('1'), 1);
		assert.equal(e('1 + 2 * 4'), 9);
		assert.equal(e('1em'), '1em');
		
		assert.equal(e('1em + 2'), '3em');
		assert.equal(e('1em+2'), '3em');

		assert.equal(e('1em - 2'), '-1em');
		assert.equal(e('1em-2'), '-1em');
		
		assert.equal(e('1em + 2px'), '3em');
		assert.equal(e('1em+2px'), '3em');

		assert.equal(e('100% / 4'), '25%');
	});

	it('comparison operators', function() {
		assert.equal(e('1 < 2'), true);
		assert.equal(e('1 > 2'), false);
		assert.equal(e('1 = 1'), true);
		assert.equal(e('2 + 2 = 2 * 2'), true);
		assert.equal(e('2 + 2 <= 2 * 2'), true);
		assert.equal(e('2 + 2 =< 2 * 2'), true); // LESS
		assert.equal(e('2 + 2 >= 2 * 2'), true);
		assert.equal(e('2 + 3 = 2 * 2'), false);
		assert.equal(e('2 + 3 != 2 * 2'), true);
	});

	it('colors', function() {
		assert.equal(e('#fc0'), '#ffcc00');
		assert.equal(e('#111 + #222'), '#333333');
		assert.equal(e('#111 > #222'), false);
		assert.equal(e('#111 + 2'), '#131313');
		assert.equal(e('#111 + 22'), '#272727');

		assert.equal(e('#555 + 2'), '#575757');
		assert.equal(e('#fff + 2'), '#ffffff');
		assert.equal(e('#111 + #222'), '#333333');
		assert.equal(e('3 * #111'), '#333333');
	});

	it('variables', function() {
		var log = [];
		var ctx = new Context({
			'@a': 2, '@b': 4,
			'$a': 2, '$b': 4,
			'@c': '@a + @b',
			'@border-color': '#111',
			'a': 1
		}, function(message) {
			log.push(message);
		});

		assert.equal(e('@a + @b', ctx), 6);
		assert.equal(e('@c * 2', ctx), 12);
		assert.equal(e('1 + @a * @b', ctx), 9);
		assert.equal(e('1 + $a * $b', ctx), 9);
		assert.equal(e('3 + @border-color', ctx), '#141414');
		assert.equal(e('a >= 0', ctx), true);
		
		assert.throws(function() {
			e('@a + @d', ctx);  // unknown variable
		}, /NaN/)
		assert.deepEqual(log, ['Missing variable "@d"']);
	});

	it('functions', function() {
		var ctx = new Context({
			'@a': 2, '@b': 4,
			'@color': '#fc0',
			'foo': function(num) {
				return num.value * 3;
			}
		});

		assert.equal(e('4 + foo(5)', ctx), '19');
		assert.equal(e('4 + foo(5, 6)', ctx), '19');

		// for unknown function should return 
		// function expression with resolved arguments
		assert.equal(e('bar(@a, @b)', ctx), 'bar(2, 4)');
		assert.equal(e('bar(@a, @b, foo(5))', ctx), 'bar(2, 4, 15)');
		assert.equal(e('foo', ctx), 'foo');

		assert.equal(e('url("a.png")'), 'url("a.png")');
		assert.equal(e('url("a.png", 3px, 0)'), 'url("a.png", 3px, 0)');
		assert.equal(e('url(image.png)'), 'url(image.png)');

		assert.equal(e('rgb(@a,@a,@a)', ctx), '#020202');
		assert.equal(e('fade(@color, 0.5)', ctx), 'rgba(255, 204, 0, 0.5)');
	});

	it('implicit color/variable conversion', function() {
		// There's `red()` function as well as `red` keyword as color.
		// Expression resolver should properly detect both cases
		var ctx = new Context();
		assert.equal(e('red', ctx), 'red');

		// in case of keywords, algebra behaviour is undefined
		assert.throws(function() {e('red + blue', ctx);}, /NaN/);
		assert.throws(function() {e('red + 3', ctx);}, /NaN/);

		assert.equal(e('red(#fc0)', ctx), '255');
		assert.equal(e('red(#fc0) + green(#fc0)', ctx), '459');
	});

	it('stringify unknown functions', function() {
		var ctx = new Context();
		assert.equal(e('foo()', ctx), 'foo()');
		assert.equal(e('foo(1 + 2)', ctx), 'foo(3)');
	});

	it('stringify invalid expressions (issue 58)', function() {
		var ctx = new Context();
		assert.throws(function() {
			e('url(path/to/image.jpg)', ctx)
		}, /NaN/);
	});

	it('expressions with comma', function() {
		assert.equal(e('1, 2'), '1, 2');
		assert.equal(e('1 + 2, 4'), '3, 4');
		assert.equal(e('2, 3 * 4'), '2, 12');
	});

	it('unit equality', function() {
		assert.equal(e('1 = 1'), true);
		assert.equal(e('1 = 2'), false);
		assert.equal(e('1px = 1%'), false);
		assert.equal(e('1px = 1'), true);
	});

	it('string equality', function() {
		assert.equal(e('"a" = "a"'), true);
		assert.equal(e('"a" = \'a\''), true);
	});

	it('color keywords in functions', function() {
		assert.equal(e('lighten(red, 10%)'), e('lighten(#f00, 10%)'));
		assert.equal(e('red(red)'), 255);
	});

	it('space operator', function() {
		var ctx = new Context({
			'@a': 2, '@b': 4,
			'$a': 2, '$b': 4,
			'$c': -123
		});

		assert.equal(e('-1px -3px'), '-1px -3px');
		assert.equal(e('-1px 3px'), '-1px 3px');
		assert.equal(e('  -1px   -3px   '), '-1px -3px');
		assert.equal(e('-1px-3px   '), '-4px');

		assert.equal(e('-@a -@b', ctx), '-2 -4');
		assert.equal(e('-@a @b', ctx), '-2 4');
		assert.equal(e('   -@a    -@b   ', ctx), '-2 -4');

		assert.throws(function() {
			// dash is a valid variable name
			e('-@a-@b', ctx);
		}, /unexpected\s+variable/i);

		assert.equal(e('-$a -$b', ctx), '-2 -4');
		assert.equal(e('-3px $c', ctx), '-3px -123');

		assert.equal(e('fn(1px 100%)'), 'fn(1px 100%)');
		assert.equal(e('fn(a b)'), 'fn(a b)');
		assert.equal(e('fn(a,b)'), 'fn(a, b)');
		assert.equal(e('fn(a, b c)'), 'fn(a, b c)');
		assert.equal(e('fn(1 2 + 3, 4 + 5 foo( 1 2 ) bar)'), 'fn(1 5, 9 foo(1 2) bar)');
		assert.equal(e('1 2 + 3, 4 + 5 foo( 1 2 ) bar'), '1 5, 9 foo(1 2) bar');
	});

	it('vendor prefix', function() {
		assert.equal(e('-fn(1 - 2)'), '-fn(-1)');
	});

	it('string interpolation', function() {
		var ctx = new Context({'@a': 2, '@b': 4});
		assert.equal(e('e(%("(\'%d\', \'%d\')", @a, @b))', ctx), '(\'2\', \'4\')');
	});

	it('issue 27', function() {
		var ctx = new Context({'@color': '#fc0'});
		assert.equal(e('fade(@color, 0)', ctx), 'rgba(255, 204, 0, 0)');
		assert.equal(e('fade(black, 0)', ctx), 'transparent');
		assert.equal(
			e('linear-gradient(to bottom, @color 0%, @color 33%, fade(@color, 0.65) 67%, fade(@color, 0) 100%)', ctx), 
			'linear-gradient(to bottom, #ffcc00 0%, #ffcc00 33%, rgba(255, 204, 0, 0.65) 67%, rgba(255, 204, 0, 0) 100%)'
		);
	});

	it('issue 70', function() {
		// https://github.com/livestyle/issues/issues/70
		
		// no magic
		var ctx1 = new Context({'@a': '28px', '@b': '35px'});
		assert.equal(e('28px/35px', ctx1), '0.8px');
		assert.equal(e('@a/@b', ctx1), '0.8px');
		assert.equal(e('@a/35px', ctx1), '0.8px');
		assert.equal(e('28px/@b', ctx1), '0.8px');
		assert.equal(e('28px / 35px', ctx1), '0.8px');
		assert.equal(e('@a / @b', ctx1), '0.8px');

		// magic mode 1: concat if no spaces
		var ctx2 = new Context({'@a': '28px', '@b': '35px', '%magic-div': 1});
		assert.equal(e('28px/35px', ctx2), '28px/35px');
		assert.equal(e('@a/@b', ctx2), '28px/35px');
		assert.equal(e('@a/35px', ctx2), '28px/35px');
		assert.equal(e('28px/@b', ctx2), '28px/35px');
		assert.equal(e('28px / 35px', ctx2), '0.8px');
		assert.equal(e('@a / @b', ctx2), '0.8px');

		// magic mode 2: concat if no spaces and plain values
		var ctx3 = new Context({'@a': '28px', '@b': '35px', '%magic-div': 2});
		assert.equal(e('28px/35px', ctx3), '28px/35px');
		assert.equal(e('@a/@b', ctx3), '0.8px');
		assert.equal(e('@a/35px', ctx3), '0.8px');
		assert.equal(e('28px/@b', ctx3), '0.8px');
		assert.equal(e('28px / 35px', ctx3), '0.8px');
		assert.equal(e('@a / @b', ctx3), '0.8px');
	});
});