/*global $, jQuery, ga, WeixinJSBridge, _report, _, Swiper, campaignTools, FastClick*/

/* jshint ignore:start */
function canvas() {
    // ----------------------------------------
    // Particle
    // ----------------------------------------
    function Particle(x, y, radius) {
        this.init(x, y, radius);
    }

    Particle.prototype = {
        init: function( x, y, radius ) {
            this.alive = true;
            this.radius = radius || 10;
            this.wander = 0.15;
            this.theta = random(TWO_PI);
            this.drag = 0.92;
            this.color = '#fff';
            this.x = x || 0.0;
            this.y = y || 0.0;
            this.vx = 0.0;
            this.vy = 0.0;
        },

        move: function() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= this.drag;
            this.vy *= this.drag;
            this.theta += random(-0.5, 0.5) * this.wander;
            this.vx += sin( this.theta ) * 0.2;
            this.vy += cos( this.theta ) * 0.1;
            this.radius *= 0.96;
            this.alive = this.radius > 0.5;
        },
        draw: function( ctx ) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, TWO_PI);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    };
    // ----------------------------------------
    // Example
    // ----------------------------------------
    var MAX_PARTICLES = 280;
    var COLOURS = ['#3720ca', '#41a19c', '#fff428', '#F38630', '#9600c8', '#FF4E50', '#1dce39'];
    var particles = [];
    var pool = [];

    var demo = Sketch.create({
        container: document.getElementById( 'container' )
    });
    demo.setup = function() {
        var i, x, y;
        // Set off some initial particles.
        for (i = 0; i < 20; i++) {
            x = (demo.width * 0.5) + random(-100, 100);
            y = (demo.height * 0.5) + random(-100, 100);
            demo.spawn(x, y);
        }
        this.r = random(30, 80);
        this.g = random(80, 180);
        this.b = random(70, 180);
    };
    demo.spawn = function( x, y ) {
        if ( particles.length >= MAX_PARTICLES )
            pool.push( particles.shift() );
        var particle = pool.length ? pool.pop() : new Particle();
        particle.init(x, y, random(5, 10));
        particle.wander = random(0.5, 2.0);
        particle.color = random(COLOURS);
        particle.drag = random(0.5, 0.99);
        var theta = random(TWO_PI);
        var force = random(2, 8);
        particle.vx = sin(theta) * force;
        particle.vy = cos(theta) * force;
        particles.push(particle);
    };
    demo.update = function() {
        var i, particle;
        for ( i = particles.length - 1; i >= 0; i-- ) {
            particle = particles[i];
            if (particle.alive) {
                particle.move();
            } else {
                pool.push(particles.splice(i, 1)[0]);
            }
        }
    };
    demo.draw = function() {
        demo.globalCompositeOperation  = 'lighter';
        for ( var i = particles.length - 1; i >= 0; i-- ) {
            particles[i].draw( demo );
        }

        var grd = this.createLinearGradient(10, 0, this.width - 10, this.height);
        grd.addColorStop(0, 'rgb(' + ~~this.r + ',' + ~~this.b + ',' + ~~this.g + ')');
        grd.addColorStop(1, 'rgb(' + ~~(this.g) + ',' + ~~(this.r) + ',' + ~~(this.b) + ')');
        this.fillStyle = grd;
        this.fillRect(0, 0, this.width, this.height);
    };
    demo.mousemove = function() {
        var particle, theta, force, touch, max, i, j, n;
        for (i = 0, n = demo.touches.length; i < n; i++) {
            touch = demo.touches[i];
            max = random(1, 4);
            for (j = 0; j < max; j++) {
                demo.spawn(touch.x, touch.y);
            }
        }
    };
}
canvas();
/* jshint ignore:end */