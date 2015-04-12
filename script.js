
var settings = {
    wave_x: 100, // leftmost point in wave
    wave_y: 200, // vertical midpoint of wave
    wave_w: 550, // width of wave
    wave_h: 100, // height of wave - # pixels under wave_y that should be filled in
    wave_color: '#9af',
    wave_period: 1, // wave goes up and down once a second
    max_a: 30 // max wave amplitude in pixels
}

$(document).ready(function() {
    var canvas = document.getElementById('waves-canvas');
    var context = canvas.getContext('2d');
    var t_0 = new Date().getTime() / 1000;

    var amplitude;
    var u = new Float32Array(settings.wave_w); // value of wave at each x
    var u_t = new Float32Array(settings.wave_w); // velocity at each x

    requestAnimationFrame(frame);

    function frame() {
        physics();
        render();
        requestAnimationFrame(frame);
    }

    function physics() {
        var t = new Date().getTime() / 1000 - t_0; // time in seconds
        var max_a = settings.max_a * Math.exp(-t / 2);
        amplitude = max_a * Math.sin(t / settings.wave_period * 2 * Math.PI);
    }

    function render() {
        period = 50 // px
        phase = 0
        context.clearRect(0, 0, 500, 500);

        var h = settings.wave_y + settings.wave_h;
        context.fillStyle = settings.wave_color;
        for (var x = settings.wave_x; x < settings.wave_x + settings.wave_w; x++) {
            var y = settings.wave_y - (amplitude * Math.sin(x / period + phase));
            context.fillRect(x, y, 1, h - y);
        }
    };
});

