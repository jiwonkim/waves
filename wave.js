/**
 * @typedef {Object} WaveSettings
 * @property {number} numSamples
 * @property {number} splashiness
 * @property {number} damping
 * @property {Array.<ChildWaveSettings>} children
 */

/**
 * Defines a sin wave. This is used to create general
 * turbulence when CHURN is called.
 *
 * @typedef {Object} ChildWaveSettings
 * @property {number} amplitude
 * @property {number} period
 */


var DEFAULT_NUM_SAMPLES = 100;
var DEFAULT_SPLASHINESS = 0.01;
var DEFAULT_DAMPING = 0.995;
var DEFAULT_CHILDREN = [
    {period: 0.25, amplitude: 0.2},
    {period: 0.5, amplitude: 0.6},
    {period: 0.3, amplitude: 0.2}
];


/**
 * Defines a single wave with the given settings.
 * @param {WaveSettings=} settings
 */
function wave(settings) {
    if (settings === undefined) {
        settings = {}
    }

    // WAVE SETTINGS
    var _n = settings.numSamples || DEFAULT_NUM_SAMPLES;
    var _children = _normalizeAmplitudes(settings.children) || DEFAULT_CHILDREN;
    var _splashiness = settings.splashiness || DEFAULT_SPLASHINESS;
    var _damping = settings.damping || DEFAULT_DAMPING;
    
    // VARS FOR THE WAVE PDE
    var u = new Float32Array(_n); // value of wave at each sample idx
    var u_t = new Float32Array(_n); // velocity at each sample idx
    var u_x = new Float32Array(_n - 1);
    var u_tt = new Float32Array(_n - 2);


    /*-----------------*/
    /* PRIVATE METHODS */
    /*-----------------*/

    function _normalizeAmplitudes(children) {
        if (!children) {
            return;
        }

        var totalAmplitude = 0;
        children.forEach(function(childWaveSettings) {
            totalAmplitude += childWaveSettings.amplitude;
        });
        children.forEach(function(childWaveSettings) {
            childWaveSettings.amplitude /= totalAmplitude;
        });
    }

    /**
     * Computes the height of the wave at sample i.
     *
     * @private
     * @param {number} i - index of the sample to compute the wave height for
     * @param {nubmer} crestIdx - index of the crest of the wave
     * @param {WaveSettings} settings
     */
    function _childHeight(i, childWaveSettings, y, phaseShift) {
        // x position of the given sample idx as a float in [0, 1]
        var x = i / _n;

        // sine wave params
        var amplitude = childWaveSettings.amplitude;
        var period = childWaveSettings.period;

        // returns the y value of the child wave at sample i, shifted so that
        // a peak occurs at the current well's index
        return 0.1 * y * amplitude * Math.sin((2 * Math.PI / period) * (x - phaseShift));
    };


    /*-----------------*/
    /*  PUBLIC METHODS */
    /*-----------------*/

    /**
     * Update the height map according to the wave equation.
     * @param {number} dt
     */
    function tick(dt) {
        if (dt === undefined) {
            dt = 0.1;
        }
        var dx = 1. / _n; // change in x per value in u

        // compute dx for each increment of x
        for (var i = 0; i < _n - 1; i++) {
            u_x[i] = (u[i + 1] - u[i]) / dx;
        }

        var c2 = _splashiness * _splashiness; // Constant C^2
        for (var i = 0; i < _n - 2; i++) {
            // compute second derivative wrt x
            var u_xx_i = (u_x[i + 1] - u_x[i]) / dx;

            // then use it to compute second derivative wrt t
            u_tt[i] = u_xx_i * c2;
        }

        // update u_t according to u_tt
        for (var i = 1; i < _n - 1; i++) {
            u_t[i] += u_tt[i - 1] * dt;
            u_t[i] *= _damping;
        }

        // update u
        for (var i = 0; i < _n; i++) {
            u[i] += u_t[i] * dt;
        }

        // cheat to send the first and last sample
        u[_n - 1] = u[_n - 2];
        u[0] = u[1];
    };

    /**
     * Create a splash in the wave.
     *
     * @param {number} x - 0 to 1
     * @param {number} y - -1 to 1
     */
    function splash(x, y, strength) {
        if (strength === undefined) {
            strength = 1;
        }
        var ix = Math.floor(x * _n);
        var totalVolume = 0;
        var peak = _clamp((y - u[ix]) * 0.5, -0.1, 0.1);
        var gaussConstant = Math.max(0.001 / Math.abs(peak), 0.01);
        var halfNumSamples = Math.floor(_n / 2);
        for(var i = -halfNumSamples; i < halfNumSamples; i++) {
            if(ix + i < 0 || ix + i > _n) {
                continue;
            }
            var gauss = strength * (Math.exp(-gaussConstant * i * i) * peak);
            u_t[ix + i] += gauss;
            u[ix + i] += gauss;
            totalVolume += gauss;
        }
        var averageVolume = totalVolume / _n;
        for(var i = 0; i < _n; i++) {
            u_t[i] -= averageVolume;
            u[i] -= averageVolume;
        }
    }

    /**
     * Create general turbulence, centered around the given x, y coords
     *
     * @param {number} x - 0 to 1
     * @param {number} y - -1 to 1
     */
    function churn(x, y, strength) {
        if (strength === undefined) {
            strength = 1;
        }
        // compute shift in phase so that the upwards peak is at the given x
        var phaseShift = x - Math.PI * 0.5;

        // Compute the height of each child wave at each sample
        // and add the offset to the current height map
        var totalVolume = 0;
        for(var i = 0; i < _n; i++) {
            _children.forEach(function(childWaveSettings) {
                var h = strength * _childHeight(i, childWaveSettings, y, phaseShift);
                u_t[i] += h;
                u[i] += h;
                totalVolume += h;
            });
        }

        // Make sure the wave level stays the same. The sum of all
        // heights at each sample should be 0, at the neutral level.
        var averageVolume = totalVolume / _n;
        for (var i = 0; i < _n; i++) {
            u_t[i] -= averageVolume;
            u[i] -= averageVolume;
        }
    }

    /**
     * Grab the height of the wave at the given sample index.
     *
     * @param {number} idx - Index of sample to grab the height for
     * @return {number} y coordinate for the wave at the sample idx. Returns a
     *      Float in [-1, 1], where 0 is the neutral level.
     */
    function height(idx) {
        return u[_clamp(idx, 0, _n - 1)];
    };


    return {
        // actions
        tick: tick,
        splash: splash,
        churn: churn,

        // getters
        height: height
    }
}

/**
 * Clamps x to [min, max]
 */
function _clamp(x, min, max) {
    return Math.max(min, Math.min(max, x))
}
