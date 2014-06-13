if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var colorKw = require('./color-keywords');

	var reRGBA = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\.\d]+)\s*)?\)/;
	var reHexColor = /^#?([a-f0-9]+)/i;
	var maxColor = (255 << 16) + (255 << 8) + 255;

	function clamp(v, max, min) {
		return Math.min(Math.max(v, min || 0), max); 
	}

	function cssHex(value) {
		value = clamp(Math.round(value), 255);
		return (value < 16 ? '0' : '') + value.toString(16);
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

	function fromDecimal(color) {
		color = clamp(color, maxColor);
		return new Color(
			(color & 0xff0000) >> 16, 
			(color & 0x00ff00) >> 8, 
			 color & 0x0000ff);
	}

	function Color(r, g, b, a) {
		this.r = +r;
		this.g = +g;
		this.b = +b;
		this.a = typeof a === 'undefined' ? 1 : +a;
	}

	Color.prototype = {
		toHex: function() {
			return '#' + this.toArray().map(cssHex).join('');
		},

		toArray: function(includeAlpha) {
			var arr = [this.r, this.g, this.b];
			if (includeAlpha) {
				arr.push(this.a);
			}

			return arr;
		},

		toDecimal: function() {
			return (this.r << 16) + (this.g << 8) + this.b;
		},

		/**
		 * Converts current color to a CSS value
		 * @return {String}
		 */
		toCSS: function() {
			if (this.a === 0) {
				return 'transparent';
			}

			if (this.a < 1) {
				var color = this.toArray().map(function(c) {
					return clamp(Math.round(c), 255);
				});
				color.push(clamp(a, 1));
				return 'rgba(' + color.join(', ') + ')';
			}

			return this.toHex();
		},

		toARGB: function() {
			return '#' + cssHex(this.a * 255) + this.toHex().substr(1);
		},

		toHSL: function() {
			var r = this.r / 255,
				g = this.g / 255,
				b = this.b / 255;

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
			return { h: h * 360, s: s, l: l, a: this.a };
		},
		//Adapted from http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
		toHSV: function() {
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
			return { h: h * 360, s: s, v: v, a: this.a };
		},

		luma: function() {
			return (0.2126 * this.r / 255) + (0.7152 * this.g / 255) + (0.0722 * this.b / 255);
		},

		valueOf: function() {
			return this.toCSS();
		}
	};

	return function(data, alpha) {
		if (data instanceof Color) {
			return data;
		}

		var color, m;
		if (typeof data == 'string') {
			data = colorKw.get(data) || data;
			if (data === 'transparent') {
				color = new Color(0, 0, 0, 0);
			} else if (m = data.match(reRGBA)) {
				color = new Color(m[1], m[2], m[3], m[4]);
			} else if (m = data.match(reHexColor)) {
				color = fromDecimal(parseInt(normalizeHex(m[1]), 16));
			} else {
				// invalid color, make it just black or thow an error?
				color = new Color(0, 0, 0);
			}
		} else if (typeof data == 'number') {
			color = fromDecimal(data);
		} else if (Array.isArray(data)) {
			color = new Color(data[0], data[1], data[2], data[3]);
		}

		if (color && typeof alpha !== 'undefined') {
			color.a = +alpha;
		}

		return color;
	};
});