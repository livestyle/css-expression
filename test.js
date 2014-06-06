var old = require('./lib/expression-eval');
var parser = require('./lib/parser');

var expr = '1 + 2 * 3';

old.parse(expr);

console.log(parser.parse(expr));

