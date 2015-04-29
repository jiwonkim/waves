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

/**
 * @typedef {Object} SplashState
 * @property {boolean} isSplashing
 * @property {number} x - the x coordinate of the splash's origin
 * @property {number} vy - the y velocity of the splash at splash origin
 */

var defaultWaveSettings = {
    numSamples: 100,
    splashiness: 0.01,
    damping: 0.995,
    children: [
        {period: 0.25, amplitude: 0.2},
        {period: 0.5, amplitude: 0.6},
        {period: 0.3, amplitude: 0.2}
    ],
}

/**
 * Defines a single wave with the given settings.
 * @param {number} n - The number of samples
 * @param {number} waveEquationConstant -  bigger the constant, the
 *      faster the wave propagates
 * @param {Array.<WaveSettings>} waveSettings - the final wave is a
 *      sum of partial waves, defined by these settings
 */
function wave(settings) {
    if (settings === undefined) {
        settings = defaultWaveSettings;
    }

    // WAVE SETTINGS
    var _n = settings.numSamples || defaultSettings.numSamples;
    var _children = _normalizeAmplitudes(settings.children) || defaultWaveSettings.children;
    var _splashiness = settings.splashiness || defaultSettings.splashiness;
    var _damping = settings.damping || defaultSettings.damping;
    
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
        var totalAmplitude = 0;
        children.forEach(function(childWaveSettings) {
            totalAmplitude += childWaveSettings.amplitude;
        });
        children.forEach(function(childWaveSettings) {
            childWaveSettings.amplitude /= totalAmplitude;
        });
    }

    function _gain() {
        var sum = 0;
        for(var i = 0; i < _n; i++) {
            var offset = 0; 
            _children.forEach(function(childWaveSettings) {
                offset += _childHeight(i, childWaveSettings);
            });
            u[i] += offset;
            sum += u[i];
        }

        // Make sure the wave level stays the same
        var avg = sum / _n;
        for (var i = 0; i < _n; i++) {
            u[i] -= avg;
        }
    }

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
     *
     */
    function splash(x, strength, isPositive) {
        _swell.start(x, strength, isPositive);
    }

    /**
     * @param {number} idx - Index of sample to grab the height for
     * @return {number} y coordinate for the wave at the sample idx
     */
    function height(idx) {
        return u[_clamp(idx, 0, _n - 1)];
    };

    /**
     * Computes the height of the wave at sample i.
     * @private
     * @param {number} i - index of the sample to compute the wave height for
     * @param {nubmer} crestIdx - index of the crest of the wave
     * @param {WaveSettings} settings
     */
    function _childHeight(i, childWaveSettings) {
        var x, swellX, phaseShift;
        x = i / _n;
        swellX = _swell.x();
        phaseShift = _swell.phaseShift();

        // returns the y value of the child wave at sample i, shifted so that
        // a peak occurs at the current well's index
        var amplitude = childWaveSettings.amplitude;
        var period = childWaveSettings.period;
        return _swell.strength() * amplitude * Math.sin((2 * Math.PI / period) * (x - phaseShift));
    };

    return {
        tick: tick,
        height: height,
        splash: splash
    }
}

function swell() {
    var DEFAULT_TICKS = 100;
    var MAX_STRENGTH = 10; // [1.0, 10.0], units: permille
    var _x = 0,
        _strength = 0,
        _phaseShift = 0,
        _gaining = false;

    var _ticks = 0,
        _currTick = 0;

    var _easingCoefficient = 0;
        
    function start(x, strength, isPositive, ticks) {
        _gaining = true;

        _x = x;
        _strength = Math.min(strength, MAX_STRENGTH) / 1000;
        if (!isPositive) {
            _strength *= -1;
        }
        _phaseShift = _x - Math.PI * 0.5;

        _currTick = 0;
        _ticks = ticks || DEFAULT_TICKS;

        _easingCoefficient = -4 * _strength / (_ticks * _ticks);
    };

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
