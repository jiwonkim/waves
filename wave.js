/**
 * @typedef {Object} WaveSettings
 * @property {number} numSamples
 * @property {number} splashiness
 * @property {number} damping
 * @property {Array.<ChildWaveSettings>} children
 */

/**
 * Defines a sin wave.
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
    
    // THE SWELL
    var _swell = swell();

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
     * Advance the swell in the wave by adding up the child waves
     */
    function _gain() {
        var totalVolume = 0;

        // Compute the height of each child wave at each sample
        // and add the offset to the current height map
        for(var i = 0; i < _n; i++) {
            _children.forEach(function(childWaveSettings) {
                u[i] += _childHeight(i, childWaveSettings);
            });

            totalVolume += u[i];
        }

        // Make sure the wave level stays the same. The sum of all
        // heights at each sample should be 0, at the neutral level.
        var averageVolume = totalVolume / _n;
        for (var i = 0; i < _n; i++) {
            u[i] -= averageVolume;
        }
    }

    /**
     * Computes the height of the wave at sample i.
     *
     * @private
     * @param {number} i - index of the sample to compute the wave height for
     * @param {nubmer} crestIdx - index of the crest of the wave
     * @param {WaveSettings} settings
     */
    function _childHeight(i, childWaveSettings) {
        // x position of the given sample idx as a float in [0, 1]
        var x = i / _n;

        // sine wave params
        var amplitude = childWaveSettings.amplitude;
        var period = childWaveSettings.period;
        var phaseShift = _swell.phaseShift();

        // returns the y value of the child wave at sample i, shifted so that
        // a peak occurs at the current well's index
        return _swell.strength() * amplitude * Math.sin((2 * Math.PI / period) * (x - phaseShift));
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

        // If we have a gaining swell in the wave, advance the swell
        if (_swell.gaining()) {
            _swell.tick();
            _gain();
        }
    };

    /**
     * Create a splash in the wave.
     *
     * @param {number} x - the x position of the splash. Float in [0, 1]
     * @param {number} strength - the strength of the splash. Float in [0, 10]
     * @param {boolean} isPositive - if true, then it's an upward splash.
     *      if false, then it's a downward splash.
     */
    function splash(x, strength, isPositive) {
        _swell.start(x, strength, isPositive);
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

        // getters
        height: height
    }
}

/**
 * Defines a swell in the wave. Keeps track of the current strength
 * of the swell, which is computed via quad out easing.
 */
function swell() {
    /** CONSTANTS **/
    var DEFAULT_TICKS = 100;
    var MAX_STRENGTH = 10; // [1.0, 10.0], units: permille

    /** PRIVATE VARIABLES **/
    var _x = 0,
        _strength = 0,
        _phaseShift = 0,
        _gaining = false;

    var _ticks = 0,
        _currTick = 0;

    var _easingCoefficient = 0;
        
    /**
     * Initialize a new swell.
     *
     * @param {number} x - The x position of the swell, a float between [0, 1]
     * @param {number} strength - The strength of the swell, float between [0, 10]
     * @param {boolean=} isPositive - if true, then it's an upward swell.
     *      if false, then it's a downward swell.
     * @param {number=} ticks - the number of ticks till the swell runs its course
     */
    function start(x, strength, isPositive, ticks) {
        _gaining = true;

        _x = x;
        _strength = Math.min(strength, MAX_STRENGTH) / 1000;
        if (!isPositive) {
            _strength *= -1;
        }

        // compute shift in phase so that the upwards peak is at the given x
        _phaseShift = _x - Math.PI * 0.5;

        // reset ticks
        _currTick = 0;
        _ticks = ticks || DEFAULT_TICKS;

        _easingCoefficient = -4 * _strength / (_ticks * _ticks);
    };

    /**
     * Advance the swell by one tick. Resets the swell if the swell has run
     * its course.
     */
    function tick() {
        _currTick++;
        if (_currTick > _ticks) {
            _gaining = false;
            _x = 0;
            _strength = 0;
            _phaseShift = 0;
            _currTick = 0;
            _ticks = 0;
        }
    }
    
    function x() {
        return _x;
    };

    function strength() {
        // ease quad out
        return _easingCoefficient * Math.pow(_currTick - _ticks / 2, 2) + _strength;
    };

    function phaseShift() {
        return _phaseShift;
    };

    function gaining() {
        return _gaining;
    };


    return {
        // actions
        start: start,
        tick: tick,

        // getters
        x: x,
        strength: strength,
        phaseShift: phaseShift,
        gaining: gaining
    }
};

/**
 * Clamps x to [min, max]
 */
function _clamp(x, min, max) {
    return Math.max(min, Math.min(max, x))
}
