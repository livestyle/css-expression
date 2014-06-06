/**
 * Functions implementations used in LESS expressions.
 * It’s a slightly modified version of original LESS implementation:
 * https://github.com/less/less.js/blob/master/lib/less/functions.js
 * 
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var _ = require('lodash');
	var stringStream = require('string-stream');
	var colors = require('./color');

	var reSpace = /[\s\u00a0]/;
	var reOps =  /[\-\+\*\/,=\!<>]/;

	var defaultUnits = {
		length: 'm',
		duration: 's',
		angle: 'rad'
	};

	var unitConversions = {
		// length
		length: {
			'm': 1,
			'cm': 0.01,
			'mm': 0.001,
			'in': 0.0254,
			'pt': 0.0254 / 72,
			'pc': 0.0254 / 72 * 12
		},

		// duration
		duration: {
			's': 1,
			'ms': 0.001
		},
		
		// angle
		angle: {
			'rad': 1/(2*Math.PI),
			'deg': 1/360,
			'grad': 1/400,
			'turn': 1
		}
	};

	function clamp(val) {
		return Math.min(1, Math.max(0, val));
	}

	/**
	 * Returns color value from expression argument
	 * @param  {Argument} val
	 * @return {Object}
	 */
	function getColor(val) {
		if (!val) {
			return null;
		};

		if (typeof val == 'object' && val.type == 'string') {
			val = val.value;
		} else if (typeof val != 'string') {
			val = val.color ? val.color() : val.valueOf();
		}
		
		return val ? colors.parse(val) : null;
	}

	function dimension(value, unit) {
		if (arguments.length == 1 && typeof value == 'object' && 'type' in value) {
			unit = value.unit;
			value = value.value;
		}

		var strValue = String(value);
		value = +value;

		if (value !== 0 && !isNaN(value)) {
			// would be output 1e-6 etc.
			strValue = value.toFixed(15).replace(/0+$/, '').replace(/\.$/, '');
		}

		return strValue + (unit || '');
    }

	function unitCoeff(unit) {
		var g = unitGroup(unit);
		return g ? g[unit] : void 0;
	}

	function unitGroupName(unit) {
		for (var p in unitConversions) if (unitConversions.hasOwnProperty(p)) {
			if (unit in unitConversions[p]) {
				return p;
			}
		}
	}

	function unitGroup(unit) {
		return unitConversions[unitGroupName(unit)];
	}

	function convertTo(value, from, to) {
		if (!from) {
			// no original unit, pick default one from group
			var g = unitGroupName(to);
			from = g ? defaultUnits[g] : '';
		}

		if (!from || !to) {
			return {
				value: value,
				unit: from
			};
		}

		return {
			value: value * unitCoeff(from) / unitCoeff(to),
			unit: to
		};
	}

	var mathFunctions = {
		// name,  unit
		ceil:  null, 
		floor: null, 
		sqrt:  null, 
		abs:   null,
		tan:   "", 
		sin:   "", 
		cos:   "",
		atan:  "rad", 
		asin:  "rad", 
		acos:  "rad"
	};

	function _math(fn, unit, n) {
		var result;
		if (unit === null) {
			unit = n.unit;
		} else if (unit === '' || unit === 'rad') {
			// convert degrees to radians, if required
			if (n.unit !== 'rad') {
				n.value = convertTo(n.value, n.unit, 'rad').value;
				n.unit = 'rad';
			}

			result = convertTo(fn(parseFloat(n.value)), n.unit, unit || 'rad');
			result.unit = unit;
		}

		if (!result) {
			result = {
				value: fn(parseFloat(n.value)),
				unit: unit
			};
		}

		return dimension(result.value, result.unit);
	}

	// Color Blending
	// ref: http://www.w3.org/TR/compositing-1
	function colorBlend(mode, color1, color2) {
		color1 = getColor(color1);
		color2 = getColor(color2);
		var ab = color1.a, cb, // backdrop
			as = color2.a, cs, // source
			ar, cr, r = {};        // result

		ar = as + ab * (1 - as);
		_.each(['r', 'g', 'b'], function(i) {
			cb = color1[i] / 255;
			cs = color2[i] / 255;
			cr = mode(cb, cs);
			if (ar) {
				cr = (as * cs + ab * (cb - as * (cb + cs - cr))) / ar;
			}
			r[i] = cr * 255;
		});

		return module.exports.rgba(r.r, r.g, r.b, ar);
	}

	var colorBlendMode = {
		multiply: function(cb, cs) {
			return cb * cs;
		},
		screen: function(cb, cs) {
			return cb + cs - cb * cs;
		},   
		overlay: function(cb, cs) {
			cb *= 2;
			return (cb <= 1)
			? colorBlendMode.multiply(cb, cs)
			: colorBlendMode.screen(cb - 1, cs);
		},
		softlight: function(cb, cs) {
			var d = 1, e = cb;
			if (cs > 0.5) {
				e = 1;
				d = (cb > 0.25) ? Math.sqrt(cb)
				: ((16 * cb - 12) * cb + 4) * cb;
			}            
			return cb - (1 - 2 * cs) * e * (d - cb);
		},
		hardlight: function(cb, cs) {
			return colorBlendMode.overlay(cs, cb);
		},
		difference: function(cb, cs) {
			return Math.abs(cb - cs);
		},
		exclusion: function(cb, cs) {
			return cb + cs - 2 * cb * cs;
		},

		// non-w3c functions:
		average: function(cb, cs) {
			return (cb + cs) / 2;
		},
		negation: function(cb, cs) {
			return 1 - Math.abs(cb + cs - 1);
		}
	};

	function hsla(color) {
		return module.exports.hsla(color.h, color.s, color.l, color.a);
	}

	function scaled(n, size) {
		if (typeof n == 'object' && n.unit == '%') {
			return parseFloat(n.value * size / 100);
		} else {
			return number(n);
		}
	}

	function number(n) {
		if (typeof n == 'object') {
			return parseFloat(n.unit == '%' ? n.value / 100 : n.value);
		} else if (typeof(n) === 'number') {
			return n;
		} else {
			throw new Error('color functions take numbers as parameters');
		}
	}

	function rgb(r, g, b, a) {
		return {r: r, g: g, b: b, a: typeof a == 'undefined' ? 1 : a};
	}

	module.exports = {
		rgb: function (r, g, b) {
			return this.rgba(r, g, b, 1);
		},
		rgba: function (r, g, b, a) {
			var rgb = [r, g, b].map(function (c) { return scaled(c, 255); });
			a = number(a);
			return {
				type: 'color',
				value: colors.parse(rgb, a)
			};
		},
		hsl: function (h, s, l) {
			return this.hsla(h, s, l, 1);
		},
		hsla: function (h, s, l, a) {
			function hue(h) {
				h = h < 0 ? h + 1 : (h > 1 ? h - 1 : h);
				if      (h * 6 < 1) { return m1 + (m2 - m1) * h * 6; }
				else if (h * 2 < 1) { return m2; }
				else if (h * 3 < 2) { return m1 + (m2 - m1) * (2/3 - h) * 6; }
				else                { return m1; }
			}

			h = (number(h) % 360) / 360;
			s = clamp(number(s));
			l = clamp(number(l));
			a = clamp(number(a));

			var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
			var m1 = l * 2 - m2;

			return this.rgba(hue(h + 1/3) * 255,
				hue(h)       * 255,
				hue(h - 1/3) * 255,
				a);
		},

		hsv: function(h, s, v) {
			return this.hsva(h, s, v, 1.0);
		},

		hsva: function(h, s, v, a) {
			h = ((number(h) % 360) / 360) * 360;
			s = number(s); v = number(v); a = number(a);

			var i, f;
			i = Math.floor((h / 60) % 6);
			f = (h / 60) - i;

			var vs = [v,
				v * (1 - s),
				v * (1 - f * s),
				v * (1 - (1 - f) * s)];
			var perm = [[0, 3, 1],
				[2, 0, 1],
				[1, 0, 3],
				[1, 2, 0],
				[3, 1, 0],
				[0, 1, 2]];

			return this.rgba(vs[perm[i][0]] * 255,
				vs[perm[i][1]] * 255,
				vs[perm[i][2]] * 255,
				a);
		},

		hue: function (arg) {
			var hsl = colors.toHSL(getColor(arg));
			return dimension(Math.round(hsl.h));
		},
		saturation: function (arg) {
			var hsl = colors.toHSL(getColor(arg));
			return dimension(Math.round(hsl.s * 100), '%');
		},
		lightness: function (arg) {
			var hsl = colors.toHSL(getColor(arg));
			return dimension(Math.round(hsl.l * 100), '%');
		},
		hsvhue: function(arg) {
			var hsv = colors.toHSV(getColor(arg));
			return dimension(Math.round(hsv.h));
		},
		hsvsaturation: function (arg) {
			var hsv = colors.toHSV(getColor(arg));
			return dimension(Math.round(hsv.s * 100), '%');
		},
		hsvvalue: function (arg) {
			var hsv = colors.toHSV(getColor(arg));
			return dimension(Math.round(hsv.v * 100), '%');
		},
		red: function (arg) {
			var rgb = colors.parse(getColor(arg));
			return dimension(Math.round(rgb.r));
		},
		green: function (arg) {
			var rgb = colors.parse(getColor(arg));
			return dimension(Math.round(rgb.g));
		},
		blue: function (arg) {
			var rgb = colors.parse(getColor(arg));
			return dimension(Math.round(rgb.b));
		},
		alpha: function (arg) {
			var hsl = colors.toHSL(getColor(arg));
			return dimension(hsl.a);
		},
		luma: function (arg) {
			arg = getColor(arg);
			var luma = colors.luma(arg);
			return dimension(Math.round(luma * colors.parse(arg).a * 100), '%');
		},
		saturate: function (color, amount) {
			color = getColor(color);
			// filter: saturate(3.2);
			// should be kept as is, so check for color
			if (!color) {
				return null;
			}

			var hsl = colors.toHSL(color);

			hsl.s += amount.value / 100;
			hsl.s = clamp(hsl.s);
			return hsla(hsl);
		},
		desaturate: function (color, amount) {
			var hsl = colors.toHSL(getColor(color));

			hsl.s -= amount.value / 100;
			hsl.s = clamp(hsl.s);
			return hsla(hsl);
		},
		lighten: function (color, amount) {
			var hsl = colors.toHSL(getColor(color));

			hsl.l += amount.value / 100;
			hsl.l = clamp(hsl.l);
			return hsla(hsl);
		},
		darken: function (color, amount) {
			var hsl = colors.toHSL(getColor(color));

			hsl.l -= amount.value / 100;
			hsl.l = clamp(hsl.l);
			return hsla(hsl);
		},
		fadein: function (color, amount) {
			var hsl = colors.toHSL(getColor(color));

			hsl.a += amount.value / 100;
			hsl.a = clamp(hsl.a);
			return hsla(hsl);
		},
		fadeout: function (color, amount) {
			var hsl = colors.toHSL(getColor(color));

			hsl.a -= amount.value / 100;
			hsl.a = clamp(hsl.a);
			return hsla(hsl);
		},

		fadeOut: function(color, amount) {
			return this.fadeout(color, amount);
		},

		fade: function (color, amount) {
			var hsl = colors.toHSL(getColor(color));

			hsl.a = amount.value / 100;
			hsl.a = clamp(hsl.a);
			return hsla(hsl);
		},
		spin: function (color, amount) {
			var hsl = colors.toHSL(getColor(color));
			var hue = (hsl.h + amount.value) % 360;

			hsl.h = hue < 0 ? 360 + hue : hue;

			return hsla(hsl);
		},
		//
		// Copyright (c) 2006-2009 Hampton Catlin, Nathan Weizenbaum, and Chris Eppstein
		// http://sass-lang.com
		//
		mix: function (color1, color2, weight) {
			if (!weight) {
				weight = {value: 50};
			}
			color1 = getColor(color1);
			color2 = getColor(color2);

			var p = weight.value / 100.0;
			var w = p * 2 - 1;
			var a = color1.a - color2.a;

			var w1 = (((w * a == -1) ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
			var w2 = 1 - w1;

			var rgb = [color1.r * w1 + color2.r * w2,
				color1.g * w1 + color2.g * w2,
				color1.b * w1 + color2.b * w2];

			var alpha = color1.a * p + color2.a * (1 - p);

			return this.rgba(rgb[0], rgb[1], rgb[2], alpha);
		},
		greyscale: function (color) {
			return this.desaturate(color, {value: 100});
		},
		contrast: function (color, dark, light, threshold) {
			// filter: contrast(3.2);
			// should be kept as is, so check for color
			color = getColor(color);
			if (!color) {
				return null;
			}

			light = getColor(light) || {r: 255, g: 255, b: 255, a: 1};
			dark = getColor(dark) || {r: 0, g: 0, b: 0, a: 1};
			
			//Figure out which is actually light and dark!
			if (colors.luma(dark) > colors.luma(light)) {
				var t = light;
				light = dark;
				dark = t;
			}
			if (typeof threshold === 'undefined') {
				threshold = 0.43;
			} else {
				threshold = number(threshold);
			}
			if (colors.luma(color) < threshold) {
				return this.rgba(light.r, light.g, light.b, light.a);
			} else {
				return this.rgba(dark.r, dark.g, dark.b, dark.a);
			}
		},
		e: function (str) {
			str = str.value || (str + '');
			var quote = str.charAt(0);
			if ((quote == '"' || quote == "'") && str.charAt(str.length - 1) == quote) {
				str = str.substring(1, str.length - 1);

			}
			return str;
		},
		escape: function (str) {
			return encodeURI(str.value).replace(/=/g, "%3D").replace(/:/g, "%3A").replace(/#/g, "%23").replace(/;/g, "%3B").replace(/\(/g, "%28").replace(/\)/g, "%29");
		},
		'%': function (quoted /* arg, arg, ...*/) {
			var args = Array.prototype.slice.call(arguments, 1),
			str = quoted.value;

			for (var i = 0; i < args.length; i++) {
				/*jshint loopfunc:true */
				str = str.replace(/%[sda]/i, function(token) {
					var value = args[i].type == 'color' ? colors.toCSS(getColor(args[i])) : args[i].value;
					return token.match(/[A-Z]$/) ? encodeURIComponent(value) : value;
				});
			}
			str = str.replace(/%%/g, '%');
			return '"' + str + '"';
		},
		unit: function (val, unit) {
			return dimension(val.value, unit ? unit.value : '');
		},
		convert: function (val, unit) {
			var result = convertTo(val.value, val.unit, unit.value);
			return dimension(result.value, result.unit);
		},
		round: function (n, f) {
			var fraction = typeof(f) === "undefined" ? 0 : f.value;
			return _math(function(num) { return num.toFixed(fraction); }, null, n);
		},
		pi: function () {
			return Math.PI;
		},
		mod: function(a, b) {
			return dimension(a.value % b.value, a.unit || b.unit);
		},
		pow: function(x, y) {
			return dimension(Math.pow(x.value, y.value), x.unit);
		},
		_minmax: function (isMin, args) {
			args = Array.prototype.slice.call(args);

			switch(args.length) {
				case 0: throw new Error('one or more arguments required');
				case 1: return dimension(args[0]);
			}

			// unify all values first: transform them to a single unit
			// also collect all unit group names to validate action
			var groups = {};
			var order = args.map(function(a) {
				var value = a;
				if (typeof a == 'string') {
					groups.string = 1;
				} else if (typeof a == 'number') {
					groups.number = 1;
				} else {
					var groupName = unitGroupName(a.unit);
					if (groupName) {
						groups[groupName] = 1;
						value = convertTo(a.value, a.unit, defaultUnits[groupName]).value;
					} else {
						groups[a.type] = 1;
						value = a.value;
					}
				}

				return {
					value: value,
					ref: a
				};
			});

			if (Object.keys(groups).length > 1) {
				// can’t compare distinct groups, tell evaluator 
				// to leave expression as is
				return null;
			}

			order.sort(function(a, b) {
				return isMin ? a.value - b.value : b.value - a.value;
			});

			return dimension(order[0].ref);
		},
		min: function () {
			return this._minmax(true, arguments);
		},
		max: function () {
			return this._minmax(false, arguments);
		},
		argb: function (arg) {
			return colors.toARGB(getColor(arg));
		},
		percentage: function (n) {
			return dimension(n.value * 100, '%');
		},
		color: function (n) {
			if (n.type == 'string') {
				var colorCandidate = n.value,
				returnColor;
				returnColor = colors.fromKeyword(colorCandidate);
				if (returnColor) {
					return returnColor;
				}
				if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/.test(colorCandidate)) {
					return colorCandidate;
				}
				throw new Error('argument must be a color keyword or 3/6 digit hex e.g. #FFF');
			} else {
				throw new Error('argument must be a string');
			}
		},
		iscolor: function (n) {
			return n.type == 'color' || !!colors.fromKeyword(n.value) || n.value == 'transparent';
		},
		isnumber: function (n) {
			return this._isa(n, 'number');
		},
		isstring: function (n) {
			return this._isa(n, 'string');
		},
		iskeyword: function (n) {
			return this._isa(n, 'string');
		},
		isurl: function (n) {
			return this._isa(n, 'string');
		},
		ispixel: function (n) {
			return this.isunit(n, 'px');
		},
		ispercentage: function (n) {
			return this.isunit(n, '%');
		},
		isem: function (n) {
			return this.isunit(n, 'em');
		},
		isunit: function (n, unit) {
			return n.unit == unit.value || n.unit == unit;
		},
		_isa: function (n, type) {
			return n && n.type == type;
		},
		tint: function(color, amount) {
			return this.mix(rgb(255,255,255), color, amount);
		},
		shade: function(color, amount) {
			return this.mix(rgb(0, 0, 0), color, amount);
		},
		extract: function() {
			var args = Array.prototype.slice.call(arguments, 0);
			var index = args.pop().value - 1;  // (1-based index)
			var values;

			if (args.length == 1 && args[0].type == 'string') {
				values = this._split(args[0].value);
			} else {
				values = _.pluck(args, 'value');
			}

			// handle non-array values as an array of length 1
			// return 'undefined' if index is invalid
			return Array.isArray(values) 
				? values[index] : Array(values)[index];
		},
		length: function(values) {
			var args = arguments;
			if (args.length == 1 && args[0].type == 'string') {
				args = this._split(values.value);
			}
			return dimension(args.length);
		},

		"data-uri": function(mimetypeNode, filePathNode) {
			throw new Error('Not implemented');
		},

		/**
		 * Split expression by parts
		 * @param  {String} expr Expression to split
		 * @return {Array} Expression parts
		 */
		_split: function(expr) {
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
						if (stream.next() == '=') {
							stream.next();
						}
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
				} else if (ch == '"' || ch == "'") {
					stream.skipString(ch);
				}
			}

			parts.push(stream.current().trim());
			return _.compact(parts);
		}
	};

	// math
	for (var f in mathFunctions) {
		module.exports[f] = _math.bind(null, Math[f], mathFunctions[f]);
	}

	// color blending
	for (f in colorBlendMode) {
		module.exports[f] = colorBlend.bind(null, colorBlendMode[f]);
	}

	return module.exports;
});