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

	// Color Blending
	// ref: http://www.w3.org/TR/compositing-1
	var blendMode = {
		multiply: function(cb, cs) {
			return cb * cs;
		},
		screen: function(cb, cs) {
			return cb + cs - cb * cs;
		},   
		overlay: function(cb, cs) {
			cb *= 2;
			return (cb <= 1)
			? this.multiply(cb, cs)
			: this.screen(cb - 1, cs);
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
			return this.overlay(cs, cb);
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
			str = str[0] + str[0]
				+ str[1] + str[1]
				+ str[2] + str[2];
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
		/**
		 * Blends current color with given one, using specified blend mode
		 * @param  {Color} color 
		 * @param  {String} mode 
		 * @return {Color}
		 */
		blend: function(color, mode) {
			if (!blendMode[mode]) {
				throw new Error('No such color blend mode: ' + mode);
			}

			var self = this;
			var ab = self.a, cb,  // backdrop
				as = color.a, cs, // source
				cr, r = new Color();   // result

			r.a = as + ab * (1 - as);
			['r', 'g', 'b'].forEach(function(i) {
				cb = self[i] / 255;
				cs = color[i] / 255;
				cr = blendMode[mode](cb, cs);
				if (r.a) {
					cr = (as * cs + ab * (cb - as * (cb + cs - cr))) / r.a;
				}
				r[i] = cr * 255;
			});

			return r;
		},
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

	var out = function(data, noFallback) {
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
			} else if (!noFallback) {
				// invalid color, make it just black or throw an error?
				color = new Color(0, 0, 0);
			}
		} else if (typeof data == 'number') {
			color = fromDecimal(data);
		} else if (Array.isArray(data)) {
			color = new Color(data[0], data[1], data[2], data[3]);
		}

		return color;
	};

	out.blendMode = blendMode;
	return out;
});