if (typeof module === 'object' && typeof define !== 'function') {
    var define = function (factory) {
        module.exports = factory(require, exports, module);
    };
}

define(function(require, exports, module) {
	var reRGBA = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\.\d]+)\s*)?\)/;
	var reHexColor = /^#?([a-f0-9]+)/i;
	var maxColor = (255 << 16) + (255 << 8) + 255;

    var colors = {
		'aliceblue':'#f0f8ff',
		'antiquewhite':'#faebd7',
		'aqua':'#00ffff',
		'aquamarine':'#7fffd4',
		'azure':'#f0ffff',
		'beige':'#f5f5dc',
		'bisque':'#ffe4c4',
		'black':'#000000',
		'blanchedalmond':'#ffebcd',
		'blue':'#0000ff',
		'blueviolet':'#8a2be2',
		'brown':'#a52a2a',
		'burlywood':'#deb887',
		'cadetblue':'#5f9ea0',
		'chartreuse':'#7fff00',
		'chocolate':'#d2691e',
		'coral':'#ff7f50',
		'cornflowerblue':'#6495ed',
		'cornsilk':'#fff8dc',
		'crimson':'#dc143c',
		'cyan':'#00ffff',
		'darkblue':'#00008b',
		'darkcyan':'#008b8b',
		'darkgoldenrod':'#b8860b',
		'darkgray':'#a9a9a9',
		'darkgrey':'#a9a9a9',
		'darkgreen':'#006400',
		'darkkhaki':'#bdb76b',
		'darkmagenta':'#8b008b',
		'darkolivegreen':'#556b2f',
		'darkorange':'#ff8c00',
		'darkorchid':'#9932cc',
		'darkred':'#8b0000',
		'darksalmon':'#e9967a',
		'darkseagreen':'#8fbc8f',
		'darkslateblue':'#483d8b',
		'darkslategray':'#2f4f4f',
		'darkslategrey':'#2f4f4f',
		'darkturquoise':'#00ced1',
		'darkviolet':'#9400d3',
		'deeppink':'#ff1493',
		'deepskyblue':'#00bfff',
		'dimgray':'#696969',
		'dimgrey':'#696969',
		'dodgerblue':'#1e90ff',
		'firebrick':'#b22222',
		'floralwhite':'#fffaf0',
		'forestgreen':'#228b22',
		'fuchsia':'#ff00ff',
		'gainsboro':'#dcdcdc',
		'ghostwhite':'#f8f8ff',
		'gold':'#ffd700',
		'goldenrod':'#daa520',
		'gray':'#808080',
		'grey':'#808080',
		'green':'#008000',
		'greenyellow':'#adff2f',
		'honeydew':'#f0fff0',
		'hotpink':'#ff69b4',
		'indianred':'#cd5c5c',
		'indigo':'#4b0082',
		'ivory':'#fffff0',
		'khaki':'#f0e68c',
		'lavender':'#e6e6fa',
		'lavenderblush':'#fff0f5',
		'lawngreen':'#7cfc00',
		'lemonchiffon':'#fffacd',
		'lightblue':'#add8e6',
		'lightcoral':'#f08080',
		'lightcyan':'#e0ffff',
		'lightgoldenrodyellow':'#fafad2',
		'lightgray':'#d3d3d3',
		'lightgrey':'#d3d3d3',
		'lightgreen':'#90ee90',
		'lightpink':'#ffb6c1',
		'lightsalmon':'#ffa07a',
		'lightseagreen':'#20b2aa',
		'lightskyblue':'#87cefa',
		'lightslategray':'#778899',
		'lightslategrey':'#778899',
		'lightsteelblue':'#b0c4de',
		'lightyellow':'#ffffe0',
		'lime':'#00ff00',
		'limegreen':'#32cd32',
		'linen':'#faf0e6',
		'magenta':'#ff00ff',
		'maroon':'#800000',
		'mediumaquamarine':'#66cdaa',
		'mediumblue':'#0000cd',
		'mediumorchid':'#ba55d3',
		'mediumpurple':'#9370d8',
		'mediumseagreen':'#3cb371',
		'mediumslateblue':'#7b68ee',
		'mediumspringgreen':'#00fa9a',
		'mediumturquoise':'#48d1cc',
		'mediumvioletred':'#c71585',
		'midnightblue':'#191970',
		'mintcream':'#f5fffa',
		'mistyrose':'#ffe4e1',
		'moccasin':'#ffe4b5',
		'navajowhite':'#ffdead',
		'navy':'#000080',
		'oldlace':'#fdf5e6',
		'olive':'#808000',
		'olivedrab':'#6b8e23',
		'orange':'#ffa500',
		'orangered':'#ff4500',
		'orchid':'#da70d6',
		'palegoldenrod':'#eee8aa',
		'palegreen':'#98fb98',
		'paleturquoise':'#afeeee',
		'palevioletred':'#d87093',
		'papayawhip':'#ffefd5',
		'peachpuff':'#ffdab9',
		'peru':'#cd853f',
		'pink':'#ffc0cb',
		'plum':'#dda0dd',
		'powderblue':'#b0e0e6',
		'purple':'#800080',
		'red':'#ff0000',
		'rosybrown':'#bc8f8f',
		'royalblue':'#4169e1',
		'saddlebrown':'#8b4513',
		'salmon':'#fa8072',
		'sandybrown':'#f4a460',
		'seagreen':'#2e8b57',
		'seashell':'#fff5ee',
		'sienna':'#a0522d',
		'silver':'#c0c0c0',
		'skyblue':'#87ceeb',
		'slateblue':'#6a5acd',
		'slategray':'#708090',
		'slategrey':'#708090',
		'snow':'#fffafa',
		'springgreen':'#00ff7f',
		'steelblue':'#4682b4',
		'tan':'#d2b48c',
		'teal':'#008080',
		'thistle':'#d8bfd8',
		'tomato':'#ff6347',
		'turquoise':'#40e0d0',
		'violet':'#ee82ee',
		'wheat':'#f5deb3',
		'white':'#ffffff',
		'whitesmoke':'#f5f5f5',
		'yellow':'#ffff00',
		'yellowgreen':'#9acd32'
	};

	function clamp(v, max) {
		return Math.min(Math.max(v, 0), max); 
	}

	function rn(num) {
		return Math.round(num);
	}

	function normalizeHex(str) {
		str = str.replace(/^#/, '');
		if (str.length == 3) {
			str = str.charAt(0) + str.charAt(0)
				+ str.charAt(1) + str.charAt(1)
				+ str.charAt(2) + str.charAt(2);
		}

		return str;
	}

	return {
		fromKeyword: function(kw) {
			return colors[kw.toLowerCase()];
		},

		/**
		 * Parses CSS color definition to RGBA
		 * @param  {Object} color Color definition
		 * @return {Object}
		 */
		parse: function(obj, alpha) {
			var color;

			if (typeof alpha == 'undefined') {
				alpha = 1;
			}

			if (typeof obj == 'string') {
				var m;
				obj = this.fromKeyword(obj) || obj;
				if (obj == 'transparent') {
					color = {r: 0, g: 0, b:0, a: 0};
				} else if (m = obj.match(reRGBA)) {
					color = {r: +m[1], g: +m[2], b: +m[3]};
					if (m[4]) {
						color.a = parseFloat(m[4]);
					}
				} else if (m = obj.match(reHexColor)) {
					obj = parseInt(normalizeHex(m[1]), 16);
				}
			}

			if (typeof obj == 'number') {
				color = this.toRGB(obj);
			} else if (Array.isArray(obj)) {
				color = {r: obj[0], g: obj[1], b: obj[2]};
				if (obj.length > 3) {
					color.a = obj[3];
				}
			} else if (typeof obj == 'object' && 'r' in obj) {
				color = obj;
			}

			if (color) {
				if (!('a' in color)) {
					color.a = alpha;
				}

				return color;
			}
		},

		/**
		 * Converts decimal color to RGB triplet
		 * @param  {Number} val Decimal color value
		 * @return {Object}
		 */
		toRGB: function(color) {
			color = clamp(color, maxColor);
			// color = Math.round(color);
			return {
				r: ((color & 0xff0000) >> 16),
    			g: ((color & 0x00ff00) >> 8),
    			b: (color & 0x0000ff)
			};
		},

		toHex: function(rgb, includeAlpha) {
			return '#' + this.toArray(rgb, includeAlpha).map(function (c) {
				c = clamp(Math.round(c), 255);
				return (c < 16 ? '0' : '') + c.toString(16);
			}).join('');
		},

		toArray: function(rgb, includeAlpha) {
			rgb = this.parse(rgb);
			var arr = [rgb.r, rgb.g, rgb.b];
			if (includeAlpha) {
				arr.push(rgb.a);
			}

			return arr;
		},

		toDecimal: function(r, g, b) {
			if (arguments.length == 1) {
				var color = this.parse(r);
				r = color.r;
				g = color.g;
				b = color.b;
			}

			var color = (r << 16) + (g << 8) + b;
			return (r << 16) + (g << 8) + b;
		},

		/**
		 * Converts givan color to a CSS value
		 * @param  {Object} rgb Color value either in decimal or parsed object format
		 * @param  {Number} a   Color alpha
		 * @return {String}
		 */
		toCSS: function(rgb, a) {
			if (typeof a == 'undefined') {
				a = 1;
				if (typeof rgb == 'object' && 'a' in rgb) {
					a = rgb.a;
				}
			}

			if (a === 0) {
				return 'transparent';
			}

			if (a < 1) {
				var color = this.toArray(rgb).map(function(c) {
					return clamp(Math.round(c), 255);
				});
				color.push(clamp(a, 1));
				return 'rgba(' + color.join(', ') + ')';
			}

			return this.toHex(rgb);
		},

		toARGB: function(rgb, a) {
			rgb = this.parse(rgb, a);
			return this.toHex([rgb.a * 255].concat(this.toArray(rgb)), true);
		},

		toHSL: function(rgb, a) {
			rgb = this.parse(rgb, a);

			var r = rgb.r / 255,
				g = rgb.g / 255,
				b = rgb.b / 255;

			var max = Math.max(r, g, b), min = Math.min(r, g, b);
			var h, s, l = (max + min) / 2, d = max - min;

			if (max === min) {
				h = s = 0;
			} else {
				s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

				switch (max) {
					case r: h = (g - b) / d + (g < b ? 6 : 0); break;
					case g: h = (b - r) / d + 2;               break;
					case b: h = (r - g) / d + 4;               break;
				}
				h /= 6;
			}
			return { h: h * 360, s: s, l: l, a: rgb.a };
		},
		//Adapted from http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
		toHSV: function(rgb, a) {
			rgb = this.parse(rgb, a);

			var r = rgb.r / 255,
				g = rgb.g / 255,
				b = rgb.b / 255;

			var max = Math.max(r, g, b), min = Math.min(r, g, b);
			var h, s, v = max;

			var d = max - min;
			if (max === 0) {
				s = 0;
			} else {
				s = d / max;
			}

			if (max === min) {
				h = 0;
			} else {
				switch(max){
					case r: h = (g - b) / d + (g < b ? 6 : 0); break;
					case g: h = (b - r) / d + 2; break;
					case b: h = (r - g) / d + 4; break;
				}
				h /= 6;
			}
			return { h: h * 360, s: s, v: v, a: rgb.a };
		},

		luma: function(rgb) {
			rgb = this.parse(rgb);
			return (0.2126 * rgb.r / 255) + (0.7152 * rgb.g / 255) + (0.0722 * rgb.b / 255);
		},

		isColor: function(val) {
			if (typeof val == 'string') {
				return reHexColor.test(val) || reRGBA.test(val);
			}
		}
	};
});