var old = require('./lib/expression-eval');
var parser = require('./lib/parser');
var expressionEval = require('./lib/evaluator');

var expr = 'foo(5, 6)';

// console.log('old eval', original.evaluate(expr));
old.parse(expr);
console.log(parser.parse(expr));
// console.log(expressionEval(expr));

