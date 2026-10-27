//! The test ladder: analytic -> reference integrator -> published numbers ->
//! properties -> golden hashes -> fuzz. The ignored tests (release) run the par
//! sweep and write REPORT.md from the numbers measured here.
use crate::game::*;
use crate::sim::*;
use crate::solve::*;
use std::fmt::Write as _;

const YD: f64 = 0.9144;
const MPH: f64 = 0.44704;
const RPM: f64 = 2.0 * std::f64::consts::PI / 60.0;

/// (name, ball speed m/s, launch deg, spin rad/s) for the reference table.
const SHOTS: [(&str, f64, f64, f64); 5] = [
    ("driver", 171.0 * MPH, 10.4, 2545.0 * RPM),
    ("7-iron", 123.0 * MPH, 16.3, 7124.0 * RPM),
    ("wedge", 104.0 * MPH, 24.0, 9316.0 * RPM),
    ("chip", 40.0 * MPH, 35.0, 6000.0 * RPM),
    ("driver, no spin", 171.0 * MPH, 10.4, 0.0),
];

#[derive(Clone, Copy, Debug, Default)]
struct Flight {
    carry: f64,
    apex: f64,
    time: f64,
    land_v: f64,
    land_deg: f64,
    land_w: f64,
}

fn launch(speed: f64, deg: f64, w: f64) -> Ball {
    let (s, c) = deg.to_radians().sin_cos();
    Ball { x: 0.0, y: 0.0, vx: speed * c, vy: speed * s, w, phase: AIR, ..Ball::new() }
}

/// The production integrator (semi-implicit Euler, 120 Hz) over flat ground at y = 0.
fn fly(mut b: Ball, wind: f64, aero: &Aero) -> Flight {
    let mut f = Flight::default();
    let mut n = 0u32;
    loop {
        let (x0, y0) = (b.x, b.y);
        b.kick(wind, aero);
        b.x += b.vx * DT;
        b.y += b.vy * DT;
        n += 1;
        if b.y > f.apex {
            f.apex = b.y;
        }
        if b.y < 0.0 && n > 1 {
            let t = y0 / (y0 - b.y);
            f.carry = x0 + (b.x - x0) * t;
            f.time = (n as f64 - 1.0 + t) * DT;
            f.land_v = (b.vx * b.vx + b.vy * b.vy).sqrt();
            f.land_deg = (-b.vy).atan2(b.vx).to_degrees();
            f.land_w = b.w;
            return f;
        }
        assert!(n < 100_000, "flight never landed");
    }
}

/// RK4 in f64 at dt = 1/4000 with the same force function.
fn fly_rk4(b: Ball, wind: f64, aero: &Aero) -> Flight {
    let h = 1.0 / 4000.0;
    let deriv = |s: [f64; 5]| -> [f64; 5] {
        let (ax, ay, dw) = accel(aero, s[2] - wind, s[3], s[4]);
        [s[2], s[3], ax, ay - G, dw]
    };
    let mut s = [b.x, b.y, b.vx, b.vy, b.w];
    let mut f = Flight::default();
    let mut n = 0u32;
    loop {
        let s0 = s;
        let k1 = deriv(s);
        let k2 = deriv(std::array::from_fn(|i| s[i] + 0.5 * h * k1[i]));
        let k3 = deriv(std::array::from_fn(|i| s[i] + 0.5 * h * k2[i]));
        let k4 = deriv(std::array::from_fn(|i| s[i] + h * k3[i]));
        s = std::array::from_fn(|i| s[i] + h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]));
        n += 1;
        if s[1] > f.apex {
            f.apex = s[1];
        }
        if s[1] < 0.0 && n > 1 {
            let t = s0[1] / (s0[1] - s[1]);
            f.carry = s0[0] + (s[0] - s0[0]) * t;
            f.time = (n as f64 - 1.0 + t) * h;
            f.land_v = (s[2] * s[2] + s[3] * s[3]).sqrt();
            f.land_deg = (-s[3]).atan2(s[2]).to_degrees();
            f.land_w = s[4];
            return f;
        }
        assert!(n < 4_000_000);
    }
}

fn flat_hole(len: f64, cup_x: f64, surf: u8) -> Hole {
    let mut h = Hole::new();
    let n = (len / SPACING) as usize + 1;
    assert!(n <= MAXN);
    h.n = n as u32;
    h.len = len;
    for i in 0..n {
        h.h[i] = 5.0;
        h.surf[i] = surf;
    }
    h.tee_x = 1.5;
    h.cup_x = cup_x;
    h.cup_y = 5.0;
    let ci = (cup_x / SPACING) as usize;
    for i in ci.saturating_sub(4)..(ci + 5).min(n) {
        h.surf[i] = GREEN;
    }
    h
}

fn sloped_hole(len: f64, slope: f64) -> Hole {
    let mut h = flat_hole(len, len - 3.0, FAIR);
    for i in 0..h.n as usize {
        h.h[i] = 5.0 + slope * i as f64 * SPACING;
    }
    h.cup_y = h.height(h.cup_x);
    h
}

fn run_ball(b: &mut Ball, h: &Hole) -> (u32, u32, u32) {
    b.run(h, &AERO)
}

struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> u32 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.0 >> 33) as u32
    }
    fn unit(&mut self) -> f64 {
        self.next() as f64 / 2147483648.0
    }
}

fn prepare(seed: u32, k: u32) -> (Hole, Solver, Prep) {
    let mut h = Hole::new();
    let mut s = Solver::new();
    let mut p = Prep::new();
    p.start(&mut h, &mut s, seed, k);
    while !p.slice(&mut h, &mut s, 1 << 16) {}
    (h, s, p)
}

fn game_on(seed: u32, k: u32) -> Game {
    let mut g = Box::new(Game::new());
    g.new_course(seed);
    g.hole_prepare(k);
    while g.hole_solve(1 << 20) < 0 {}
    assert_eq!(g.hole_start(), 1);
    *g
}

fn assert_finite(b: &Ball) {
    assert!(b.x.is_finite() && b.y.is_finite() && b.vx.is_finite() && b.vy.is_finite() && b.w.is_finite(), "{:?}", (b.x, b.y, b.vx, b.vy, b.w));
}

// ------------------------------------------------------------------ 1. analytic

#[test]
fn vacuum_closed_form() {
    let (dx, dy) = dir(32);
    let v0 = 30.0;
    let mut b = Ball { x: 0.0, y: 0.0, vx: v0 * dx, vy: v0 * dy, w: 0.0, phase: AIR, ..Ball::new() };
    let mut n = 0u32;
    loop {
        let (x0, y0) = (b.x, b.y);
        b.kick(0.0, &VACUUM);
        b.x += b.vx * DT;
        b.y += b.vy * DT;
        n += 1;
        let t = n as f64 * DT;
        assert!((b.x - v0 * dx * t).abs() <= 1e-9, "x drifts at step {n}");
        let y_exact = v0 * dy * t - 0.5 * G * t * t;
        assert!((b.y - y_exact).abs() <= G * t * DT / 2.0 + 1e-9, "y outside the semi-implicit bound at step {n}");
        if b.y < 0.0 && n > 1 {
            let f = y0 / (y0 - b.y);
            let range = x0 + (b.x - x0) * f;
            let exact = v0 * v0 * (2.0 * dx * dy) / G;
            assert!(range > 0.0 && exact > 0.0);
            assert!((range - exact).abs() / exact < 0.005, "range {range} vs {exact}");
            break;
        }
    }
}

#[test]
fn newton_sqrt_within_1ulp() {
    let mut r = Lcg(7);
    for _ in 0..100_000 {
        let x = f64::from_bits(r.next() as u64) * 1e-9 + r.unit() * 1e4;
        let a = sqrt(x);
        let b = x.sqrt();
        let ulp = (a.to_bits() as i64 - b.to_bits() as i64).abs();
        assert!(ulp <= 1, "sqrt({x}) off by {ulp} ulp");
    }
    assert_eq!(sqrt(0.0), 0.0);
    assert_eq!(sqrt(-1.0), 0.0);
    assert_eq!(sqrt(4.0), 2.0);
}

#[test]
fn direction_table_is_unit() {
    for q in 0..256 {
        let (x, y) = dir(q);
        assert!((x * x + y * y - 1.0).abs() < 1e-15);
    }
    assert_eq!(dir(0), (1.0, 0.0));
    assert_eq!(dir(64), (0.0, 1.0));
    assert_eq!(dir(128), (-1.0, 0.0));
    assert!(speed(0) == 0.0 && speed(63) == V_MAX);
    for q in 1..64 {
        assert!(speed(q) > speed(q - 1));
    }
}

// ----------------------------------------------------------------- 2. reference

fn reference_table() -> Vec<(&'static str, Flight, Flight)> {
    SHOTS.iter().map(|&(name, v, deg, w)| (name, fly(launch(v, deg, w), 0.0, &AERO), fly_rk4(launch(v, deg, w), 0.0, &AERO))).collect()
}

#[test]
fn reference_rk4_table() {
    for (name, sim, rk4) in reference_table() {
        let dc = (sim.carry - rk4.carry) / rk4.carry;
        assert!(dc.abs() <= 0.0075, "{name}: carry error {:.3} %", dc * 100.0);
        assert!(sim.carry < rk4.carry, "{name}: the semi-implicit step should fall short, not long");
        assert!(((sim.apex - rk4.apex) / rk4.apex).abs() <= 0.01, "{name}: apex");
        assert!(((sim.time - rk4.time) / rk4.time).abs() <= 0.01, "{name}: flight time");
    }
}

#[test]
fn tour_carries_within_5pct() {
    for (i, yd) in [(0usize, 282.0), (1, 176.0), (2, 142.0)] {
        let (name, v, deg, w) = SHOTS[i];
        let f = fly(launch(v, deg, w), 0.0, &AERO);
        let err = (f.carry - yd * YD) / (yd * YD);
        assert!(err.abs() <= 0.05, "{name}: carry {:.1} m vs {yd} yd ({:.1} %)", f.carry, err * 100.0);
    }
}

#[test]
fn landing_matches_biber_tee_shot() {
    let (_, v, deg, w) = SHOTS[0];
    let f = fly(launch(v, deg, w), 0.0, &AERO);
    assert!((f.land_v - 28.5).abs() <= 2.0, "landing speed {}", f.land_v);
    assert!((f.land_deg - 37.3).abs() <= 2.0, "descent {}", f.land_deg);
    assert!((f.land_w / RPM - 2094.0).abs() <= 200.0, "landing spin {} rpm", f.land_w / RPM);
}

// ---------------------------------------------------------------- 3. properties

#[test]
fn zero_spin_zero_lift() {
    let mut r = Lcg(3);
    for _ in 0..1000 {
        let ux = (r.unit() - 0.5) * 120.0;
        let uy = (r.unit() - 0.5) * 120.0;
        let (ax, ay, dw) = accel(&AERO, ux, uy, 0.0);
        let u = sqrt(ux * ux + uy * uy);
        assert_eq!(ax, -AERO.k * u * (AERO.cd0 * ux));
        assert_eq!(ay, -AERO.k * u * (AERO.cd0 * uy));
        assert_eq!(dw, 0.0);
    }
}

#[test]
fn topspin_pushes_down() {
    let mut r = Lcg(5);
    for _ in 0..1000 {
        let ux = 1.0 + r.unit() * 70.0;
        let uy = (r.unit() - 0.5) * 40.0;
        let w = -1.0 - r.unit() * 1200.0;
        let u = sqrt(ux * ux + uy * uy);
        let s = (w * R / u).max(-AERO.s_max);
        let drag_only = -AERO.k * u * ((AERO.cd0 + AERO.cdk * s * s) * uy);
        let (_, ay, _) = accel(&AERO, ux, uy, w);
        assert!(ay < drag_only, "topspin must push down: {ay} vs drag alone {drag_only}");
        let (_, ayb, _) = accel(&AERO, ux, uy, -w);
        assert!(ayb > drag_only, "backspin must lift");
    }
}

#[test]
fn drag_never_adds_speed() {
    let mut r = Lcg(11);
    for _ in 0..10_000 {
        let vx = (r.unit() - 0.5) * 100.0;
        let vy = (r.unit() - 0.5) * 100.0;
        let wind = (r.unit() - 0.5) * 12.0;
        let w = (r.unit() - 0.5) * 2400.0;
        let (ux, uy) = (vx - wind, vy);
        let (ax, ay, _) = accel(&AERO, ux, uy, w);
        assert!(ax * ux + ay * uy <= 0.0, "aero force has a component along the relative wind");
        let (ax0, ay0, _) = accel(&AERO, vx, vy, w);
        assert!(ax0 * vx + ay0 * vy <= 0.0);
    }
}

#[test]
fn aero_acceleration_bounded() {
    let mut r = Lcg(13);
    let cd_max = AERO.cd0 + AERO.cdk * AERO.s_max * AERO.s_max;
    let cl_max = AERO.clmax * AERO.s_max / (AERO.s_max + AERO.s0);
    for _ in 0..10_000 {
        let ux = (r.unit() - 0.5) * 120.0;
        let uy = (r.unit() - 0.5) * 120.0;
        let w = (r.unit() - 0.5) * 2400.0;
        let (ax, ay, dw) = accel(&AERO, ux, uy, w);
        let u2 = ux * ux + uy * uy;
        let a = (ax * ax + ay * ay).sqrt();
        assert!(a <= AERO.k * u2 * (cd_max + cl_max) + 1e-9);
        assert!(dw.abs() <= AERO.lambda * u2.sqrt() / R * w.abs() + 1e-12);
    }
}

#[test]
fn monotone_effects() {
    let (_, v, deg, w) = SHOTS[0];
    let head = fly(launch(v, deg, w), -5.0, &AERO).carry;
    let calm = fly(launch(v, deg, w), 0.0, &AERO).carry;
    let tail = fly(launch(v, deg, w), 5.0, &AERO).carry;
    assert!(head < calm && calm < tail, "{head} {calm} {tail}");
    let no_spin = fly(launch(v, deg, 0.0), 0.0, &AERO).carry;
    assert!(calm - no_spin > 45.0, "backspin adds {} m", calm - no_spin);
    // 4500 rpm at 5 m/s: the spin ratio is clamped, so the force equals the force at exactly S_MAX.
    let u = 5.0;
    let clamped = accel(&AERO, u, 0.0, SPIN[3]);
    let at_cap = accel(&AERO, u, 0.0, AERO.s_max * u / R);
    assert!(SPIN[3] * R / u > AERO.s_max);
    assert_eq!((clamped.0, clamped.1), (at_cap.0, at_cap.1));
    assert!(clamped.0.is_finite() && clamped.1.is_finite());
}

#[test]
fn spin_settings_differ() {
    // At full power the fitted lift saturates by 1500 rpm, so the three spin
    // settings differ from spin 0 by 10 m or more but from each other by less
    // than 3 m of carry; what separates them is the descent angle and the roll-out.
    let (dx, dy) = dir(8);
    let full = |q: usize| fly(Ball { x: 0.0, y: 0.0, vx: V_MAX * dx, vy: V_MAX * dy, w: SPIN[q], phase: AIR, ..Ball::new() }, 0.0, &AERO);
    let f: Vec<Flight> = (0..4).map(full).collect();
    for q in 1..4 {
        assert!(f[q].carry - f[0].carry > 10.0, "spin {q} adds {:.1} m", f[q].carry - f[0].carry);
    }
    let (dx, dy) = dir(16);
    let steep: Vec<f64> = (0..4).map(|q| fly(Ball { x: 0.0, y: 0.0, vx: V_MAX * dx, vy: V_MAX * dy, w: SPIN[q], phase: AIR, ..Ball::new() }, 0.0, &AERO).land_deg).collect();
    for q in 1..4 {
        assert!(steep[q] > steep[q - 1] + 0.5, "more spin lands steeper: {steep:?}");
    }
    let h = flat_hole(79.0, 70.0, FAIR);
    let rest: Vec<f64> = (0..4)
        .map(|s| {
            let mut b = Ball::new();
            b.rest_at(&h, 1.0);
            assert!(b.shoot(24, 40, s));
            let (ph, _, ev) = run_ball(&mut b, &h);
            assert!(ph == READY && ev & EV_WALL == 0);
            b.x
        })
        .collect();
    for q in 1..4 {
        assert!(rest[q] < rest[q - 1] - 0.4, "more backspin rolls out less: {rest:?}");
    }
}

#[test]
fn finite_everywhere_10k() {
    let mut r = Lcg(17);
    let mut h = Hole::new();
    for i in 0..10_000u32 {
        if i % 50 == 0 {
            h.generate(r.next(), i % 9, 0);
            h.wind = (r.unit() * 13.0) as u32 as f64 - 6.0;
        }
        let x = 0.5 + r.unit() * (h.len - 1.0);
        let mut b = Ball::new();
        b.rest_at(&h, x);
        assert!(b.shoot(r.next() & 255, r.next() & 63, r.next() & 3));
        b.w = (r.unit() - 0.5) * 2400.0;
        let mut n = 0;
        while b.moving() {
            let v0 = (b.vx, b.vy);
            let bounces = b.bounces;
            let was_air = b.phase == AIR;
            let ev = b.step(&h, &AERO);
            n += 1;
            assert_finite(&b);
            if was_air && b.phase == AIR && b.bounces == bounces && ev & EV_WALL == 0 {
                let dv = ((b.vx - v0.0).powi(2) + (b.vy - v0.1).powi(2)).sqrt();
                let u = ((v0.0 - h.wind).powi(2) + v0.1.powi(2)).sqrt();
                let bound = (G + AERO.k * u * u * (0.338 + 0.25)) * DT + 1e-9;
                assert!(dv <= bound, "step {n}: dv {dv} > {bound}");
            }
            let under = h.height(b.x) - b.y;
            assert!(under <= 1e-9 || h.surf[h.seg(b.x)] == WATER, "below the surface by {under} at step {n}");
        }
        assert!(n <= MAX_SHOT_TICKS + 1, "shot {i} took {n} steps");
        assert!(n <= 7200);
        assert_finite(&b);
    }
}

#[test]
fn no_tunnelling_swept() {
    let mut r = Lcg(19);
    let mut h = flat_hole(40.0, 30.0, FAIR);
    let mut max_bounces = 0;
    for i in 0..10_000u32 {
        if i % 100 == 0 {
            // Random terrain with slopes up to 1.5 (steeper than the generator ever makes).
            let mut y = 5.0;
            for j in 0..h.n as usize {
                h.h[j] = y;
                y += (r.unit() - 0.5) * 1.5;
                if y < 2.0 {
                    y = 2.0;
                }
            }
            h.cup_y = h.height(h.cup_x);
            h.wind = (r.unit() * 13.0) as u32 as f64 - 6.0;
        }
        let x = 0.25 + r.unit() * (h.len - 0.5);
        let mut b = Ball::new();
        b.rest_at(&h, x);
        assert!(b.shoot(r.next() & 255, 63, r.next() & 3));
        let mut n = 0;
        while b.moving() {
            b.step(&h, &AERO);
            n += 1;
            let under = h.height(b.x) - b.y;
            assert!(under <= 1e-9, "shot {i}: below the surface by {under} at step {n}");
            assert!(b.x >= 0.0 && b.x <= h.len);
        }
        max_bounces = max_bounces.max(b.bounces);
        assert!(b.bounces <= 40, "shot {i}: {} bounces", b.bounces);
    }
    assert!(max_bounces > 0);
}

// --------------------------------------------------------------- 4. edge cases

#[test]
fn power_zero_stays_put() {
    let h = flat_hole(30.0, 20.0, FAIR);
    let mut b = Ball::new();
    b.rest_at(&h, 5.0);
    assert!(b.shoot(32, 0, 0));
    let (ph, n, _) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(n <= 32, "{n} steps");
    assert!((b.x - 5.0).abs() < 1e-9);
    assert_finite(&b);
    // With spin the dropped ball kicks back a few millimetres (slip impulse), then rests.
    let mut b = Ball::new();
    b.rest_at(&h, 5.0);
    assert!(b.shoot(32, 0, 2));
    let (ph, n, _) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(n <= 240, "{n} steps");
    assert!((b.x - 5.0).abs() < 0.01, "rests at {}", b.x);
    assert_finite(&b);
}

#[test]
fn wind_faster_than_ball() {
    let mut h = flat_hole(30.0, 20.0, FAIR);
    h.wind = 6.0;
    let mut b = Ball::new();
    b.rest_at(&h, 10.0);
    assert!(b.shoot(64, 7, 0));
    assert!(speed(7) < 2.5 && speed(7) > 1.5);
    let (ph, _, ev) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(ev & EV_LAND != 0);
    assert!(b.x > 10.0, "a tailwind drifts the ball downwind");
    assert_finite(&b);
}

#[test]
fn extreme_spin_slow_ball() {
    let h = flat_hole(30.0, 20.0, FAIR);
    let mut b = Ball::new();
    b.rest_at(&h, 10.0);
    assert!(b.shoot(32, 5, 3));
    let u = (b.vx * b.vx + b.vy * b.vy).sqrt();
    assert!(b.w * R / u > AERO.s_max, "the clamp is hit at launch");
    let (ph, _, _) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert_finite(&b);
}

#[test]
fn launch_on_seam_vertex() {
    let h = sloped_hole(40.0, 0.3);
    let mut b = Ball::new();
    b.rest_at(&h, 10.0);
    assert_eq!(b.x, 10.0);
    assert!(b.shoot(20, 40, 2));
    let (ph, _, ev) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(ev & EV_LAND != 0);
    assert_finite(&b);
    assert!(h.height(b.x) - b.y <= 1e-9);
}

#[test]
fn grazing_1deg_settles() {
    let h = flat_hole(60.0, 50.0, FAIR);
    let mut b = Ball::new();
    b.rest_at(&h, 5.0);
    b.phase = AIR;
    b.y += 0.01;
    b.vx = 10.0;
    b.vy = -10.0 * 1f64.to_radians().tan();
    let mut n = 0;
    while b.phase == AIR {
        b.step(&h, &AERO);
        n += 1;
        assert!(n < 200);
    }
    assert_eq!(b.phase, GROUND);
    assert!(b.bounces <= 3, "{} bounces", b.bounces);
}

fn rolling_at(h: &Hole, x: f64, vt: f64) -> Ball {
    let mut b = Ball::new();
    b.rest_at(h, x);
    b.phase = GROUND;
    let i = h.seg(x);
    let (tx, ty) = h.tangent(i);
    b.vx = vt * tx;
    b.vy = vt * ty;
    b.w = -vt / R;
    b
}

#[test]
fn cup_fast_lips_out() {
    let h = flat_hole(30.0, 20.0, GREEN);
    let mut b = rolling_at(&h, 19.0, 3.0);
    let (ph, _, ev) = run_ball(&mut b, &h);
    assert_ne!(ph, HOLED);
    assert!(ev & EV_RIM != 0);
    assert!(b.x > 20.0 && b.x < 20.5, "a slow miss is kicked to a tap-in, rests at {}", b.x);
}

#[test]
fn cup_slow_drops() {
    let h = flat_hole(30.0, 20.0, GREEN);
    let mut b = rolling_at(&h, 19.0, 1.5);
    let (ph, _, ev) = run_ball(&mut b, &h);
    assert_eq!(ph, HOLED);
    assert!(ev & EV_HOLED != 0);
    assert_eq!(b.x, 20.0);
}

#[test]
fn cup_fast_miss_keeps_rolling() {
    let h = flat_hole(60.0, 20.0, GREEN);
    let mut b = rolling_at(&h, 19.0, 6.0);
    let (ph, _, ev) = run_ball(&mut b, &h);
    assert_ne!(ph, HOLED);
    assert!(ev & EV_RIM != 0);
    assert!(b.x > 25.0, "rests at {}", b.x);
}

#[test]
fn pitch_into_cup_holes() {
    let h = flat_hole(30.0, 20.0, GREEN);
    let mut b = Ball::new();
    b.rest_at(&h, 19.0);
    b.phase = AIR;
    b.x = 20.0 - 0.01 - 6.0 * 0.5 * DT;
    b.y = 5.0 + 6.0 * 0.866 * DT * 2.0;
    b.vx = 6.0 * 0.5;
    b.vy = -6.0 * 0.866;
    let (ph, n, ev) = run_ball(&mut b, &h);
    assert_eq!(ph, HOLED, "landed at {} after {n} steps", b.x);
    assert!(ev & EV_HOLED != 0);
}

#[test]
fn pitch_on_the_rim_bounces() {
    let h = flat_hole(30.0, 20.0, GREEN);
    let mut b = Ball::new();
    b.rest_at(&h, 19.0);
    b.phase = AIR;
    b.x = 20.0 + CUP_R - 0.005;
    b.y = 5.0 + 0.03;
    b.vx = 0.0;
    b.vy = -6.0;
    let ev = b.step(&h, &AERO);
    assert_ne!(b.phase, HOLED);
    assert!(ev & EV_RIM != 0 && ev & EV_LAND != 0);
}

#[test]
fn rest_on_lip_no_spin_loop() {
    let h = flat_hole(30.0, 20.0, GREEN);
    let mut b = rolling_at(&h, 20.06, -0.04);
    let (ph, n, _) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(n < 240, "{n} steps");
    assert!(b.x > 20.0 + CUP_R && b.x < 20.07);
}

#[test]
fn water_penalty_respawn() {
    let mut g = game_on(1, 5);
    let w = (0..g.cur.n as usize).find(|&i| g.cur.surf[i] == WATER).expect("hole 6 has water");
    let x = (w + 2) as f64 * SPACING;
    g.ball.rest_at(&g.cur, 5.0);
    g.ball.phase = AIR;
    g.ball.x = x;
    g.ball.y = g.cur.water_y + 1.0;
    g.strokes = 1;
    let ev = g.settle();
    assert!(ev & EV_WATER != 0);
    assert_eq!(g.strokes, 2, "one penalty stroke");
    assert_eq!(g.ball.x, 5.0, "back to the last rest position");
    assert_eq!(g.ball.phase, READY);
}

#[test]
fn wall_out_of_bounds() {
    let h = flat_hole(30.0, 20.0, FAIR);
    let mut b = Ball::new();
    b.rest_at(&h, 2.0);
    assert!(b.shoot(136, 63, 0));
    let mut ev = 0;
    while b.moving() {
        ev |= b.step(&h, &AERO);
        assert!(b.x >= 0.0 && b.x <= h.len);
    }
    assert!(ev & EV_WALL != 0);
    let mut b = Ball::new();
    b.rest_at(&h, 28.0);
    assert!(b.shoot(8, 63, 0));
    let (_, _, ev) = run_ball(&mut b, &h);
    assert!(ev & EV_WALL != 0 && b.x <= h.len);
}

#[test]
fn twenty_strokes_ends_hole() {
    let mut g = game_on(2, 0);
    let mut last = 0;
    for i in 0..MAX_SHOTS as u32 {
        assert_eq!(g.shoot(32, 0, 0), 1, "shot {i}");
        last = g.settle();
    }
    assert!(last & EV_OVER != 0);
    assert_eq!(g.ball.phase, HOLED);
    assert_eq!(g.shoot(32, 10, 0), 0);
    assert_eq!(g.holes_done, 1);
    assert_eq!(g.total_strokes, 20);
    assert!(!g.playing);
}

#[test]
fn preview_before_start_is_noop() {
    let mut g = Box::new(Game::new());
    g.new_course(5);
    g.preview(32, 40, 2);
    assert_eq!(g.preview_n, 0);
    assert_eq!(g.shoot(32, 40, 2), 0);
    assert_eq!(g.advance(16.0), 0);
    assert_eq!(g.hole_start(), 0);
    assert_eq!(g.hole_solve(100), -1);
    assert_eq!(g.bot_shot(), 0);
    g.restart();
    let mut g = game_on(5, 0);
    g.preview(32, 40, 2);
    assert!(g.preview_n > 0 && g.preview_n <= 64);
    assert!(g.preview[0] > g.cur.tee_x);
}

#[test]
fn stop_rule_holds_on_gentle_slope() {
    let h = sloped_hole(40.0, 0.1);
    let mut b = rolling_at(&h, 10.0, 0.5);
    let (ph, n, ev) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(ev & EV_REST != 0);
    assert!(b.x > 10.0 && b.x < 10.2, "rests uphill of the start at {}", b.x);
    assert!(n < 240);
}

#[test]
fn rolls_off_steep_slope() {
    let h = sloped_hole(40.0, 0.7);
    let mut b = rolling_at(&h, 20.0, 0.0);
    let (ph, _, _) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(b.x < 2.0, "rolled down to {}", b.x);
}

#[test]
fn rests_in_valley_vertex() {
    let mut h = flat_hole(40.0, 35.0, FAIR);
    for i in 0..h.n as usize {
        h.h[i] = 5.0 + 0.8 * (i as f64 * SPACING - 15.0).abs();
    }
    h.cup_y = h.height(h.cup_x);
    assert!(h.is_valley(30));
    let mut b = rolling_at(&h, 20.0, 0.0);
    let (ph, n, ev) = run_ball(&mut b, &h);
    assert_eq!(ph, READY);
    assert!(ev & EV_REST != 0);
    assert_eq!(b.x, 15.0, "rests on the vertex, not chattering around it");
    assert!(n < 1200, "{n} steps");
}

// ----------------------------------------------------------- 5. determinism

const SCRIPT: [(u32, u32, u32); 6] = [(20, 63, 2), (30, 40, 1), (10, 30, 0), (40, 20, 3), (16, 12, 2), (24, 8, 2)];
const GOLDEN_SEEDS: [u32; 3] = [20261027, 1, 0xdeadbeef];

fn play_script(g: &mut Game) {
    for &(a, p, s) in SCRIPT.iter() {
        if g.shoot(a, p, s) == 0 {
            break;
        }
        g.settle();
    }
}

fn golden_lines() -> String {
    let mut out = String::new();
    for &seed in GOLDEN_SEEDS.iter() {
        let mut g = Box::new(Game::new());
        g.new_course(seed);
        for k in 0..HOLES as u32 {
            g.hole_prepare(k);
            while g.hole_solve(1 << 20) < 0 {}
            assert_eq!(g.hole_start(), 1);
            play_script(&mut g);
            writeln!(out, "{seed} {k} {:016x}", g.hash).unwrap();
        }
    }
    out
}

#[test]
fn golden_hashes() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/golden.txt");
    let got = golden_lines();
    if std::env::var("UPDATE_GOLDEN").is_ok() {
        std::fs::write(path, &got).unwrap();
    }
    let want = std::fs::read_to_string(path).expect("golden.txt (run with UPDATE_GOLDEN=1 to create)");
    assert_eq!(got.replace("\r\n", "\n"), want.replace("\r\n", "\n"), "golden hashes changed");
}

#[test]
fn frame_schedule_independence() {
    let schedules: [&[f64]; 3] = [&[16.67], &[8.33], &[33.0, 7.0, 50.0, 1.0, 16.0, 300.0, 2.0, 24.0]];
    let mut results = Vec::new();
    for (si, sched) in schedules.iter().enumerate() {
        let mut g = game_on(20261027, 3);
        assert_eq!(g.shoot(28, 50, 2), 1);
        let mut i = 0;
        let mut ev = 0;
        while g.ball.moving() {
            ev |= g.advance(sched[i % sched.len()]);
            i += 1;
        }
        assert!(ev & EV_REST != 0 || ev & EV_HOLED != 0);
        if si == 2 {
            assert!(g.tele[0] >= 1, "the 300 ms frame is clamped");
            assert!(g.tele[1] > 0, "and its lost time is counted");
        } else {
            assert_eq!(g.tele[0], 0);
        }
        results.push((g.hash, g.view.map(f64::to_bits), g.tele[2]));
    }
    let mut g = game_on(20261027, 3);
    assert_eq!(g.shoot(28, 50, 2), 1);
    g.settle();
    results.push((g.hash, g.view.map(f64::to_bits), g.tele[2]));
    for r in &results[1..] {
        assert_eq!(r, &results[0]);
    }
}

#[test]
fn solver_resumable_equals_oneshot() {
    for seed in [20261027u32, 1, 0xdeadbeef] {
        for k in 0..HOLES as u32 {
            let (h1, _, _) = prepare(seed, k);
            let mut h2 = Hole::new();
            let mut s = Solver::new();
            let mut p = Prep::new();
            p.start(&mut h2, &mut s, seed, k);
            while !p.slice(&mut h2, &mut s, 48) {}
            assert_eq!((h1.best, h1.par), (h2.best, h2.par), "seed {seed} hole {k}");
            assert_eq!(h1.h[..h1.n as usize], h2.h[..h2.n as usize]);
        }
    }
}

#[test]
fn regenerate_and_fallback_branches() {
    let mut h = Hole::new();
    let mut s = Solver::new();
    let mut p = Prep::new();
    p.force_fail = SOLVE_ATTEMPTS;
    p.start(&mut h, &mut s, 9, 2);
    while !p.slice(&mut h, &mut s, 1 << 16) {}
    assert_eq!(p.attempt, SOLVE_ATTEMPTS);
    assert_eq!(h.par, h.fallback_par());
    assert!(h.par >= 2 && h.par <= 5);

    let mut h1 = Hole::new();
    let mut p = Prep::new();
    p.force_fail = 1;
    p.start(&mut h1, &mut s, 9, 2);
    while !p.slice(&mut h1, &mut s, 1 << 16) {}
    assert_eq!(p.attempt, 1);
    assert!(h1.best >= 1 && h1.par == (h1.best as u32 + 1).max(2).min(5));
    let mut h2 = Hole::new();
    let mut p = Prep::new();
    p.force_fail = 1;
    p.start(&mut h2, &mut s, 9, 2);
    while !p.slice(&mut h2, &mut s, 1 << 16) {}
    assert_eq!(h1.h[..h1.n as usize], h2.h[..h2.n as usize], "regeneration is deterministic");
    let mut h0 = Hole::new();
    h0.generate(9, 2, 0);
    assert_ne!(h0.h[..h0.n as usize], h1.h[..h1.n as usize], "attempt 1 is a different layout");
}

#[test]
fn bot_plays_a_hole() {
    let mut g = game_on(20261027, 0);
    let mut shots = 0;
    while g.playing && shots < 20 {
        let m = g.bot_shot();
        assert_ne!(m, 0);
        assert_eq!(g.shoot(m & 255, m >> 8 & 63, m >> 14 & 3), 1);
        g.settle();
        shots += 1;
    }
    assert_eq!(g.ball.phase, HOLED);
    assert!(g.strokes <= g.cur.par + 2, "bot took {} on par {}", g.strokes, g.cur.par);
}

// ------------------------------------------------------------------ 6. replay

fn played_course(seed: u32, holes: u32) -> Game {
    let mut g = Box::new(Game::new());
    g.new_course(seed);
    for k in 0..holes {
        g.hole_prepare(k);
        while g.hole_solve(1 << 20) < 0 {}
        assert_eq!(g.hole_start(), 1);
        while g.playing {
            let m = g.bot_shot();
            g.shoot(m & 255, m >> 8 & 63, m >> 14 & 3);
            g.settle();
        }
    }
    *g
}

fn verify(code: &[u8]) -> i32 {
    let mut raw = [0u8; 384];
    let r = Game::replay_parse(code, &mut raw);
    if r < 0 {
        return r;
    }
    let mut v = Box::new(Game::new());
    v.replay_verify(&raw, r as usize)
}

#[test]
fn replay_round_trip_matches() {
    let mut g = played_course(20261027, 2);
    let n = g.replay_encode() as usize;
    let code = g.replay[..n].to_vec();
    assert!(code.iter().all(|c| B64.contains(c)));
    assert_eq!(verify(&code), 1);
    let mut v = Box::new(Game::new());
    let mut raw = [0u8; 384];
    let r = Game::replay_parse(&code, &mut raw);
    v.replay_verify(&raw, r as usize);
    assert_eq!(v.replay_seed, 20261027);
    assert_eq!(v.replay_summary, [2, g.total_strokes, g.total_par]);
}

#[test]
fn restart_then_replay_matches() {
    let mut g = Box::new(Game::new());
    g.new_course(20261027);
    g.hole_prepare(0);
    while g.hole_solve(1 << 20) < 0 {}
    assert_eq!(g.hole_start(), 1);
    let at_start = g.hash;
    assert_eq!(g.shoot(0, 10, 0), 1);
    g.settle();
    assert_ne!(g.hash, at_start, "a rest feeds the chain");
    g.restart();
    assert_eq!(g.hash, at_start, "restart rewinds the chain");
    while g.playing {
        let m = g.bot_shot();
        g.shoot(m & 255, m >> 8 & 63, m >> 14 & 3);
        g.settle();
    }
    let n = g.replay_encode() as usize;
    let code = g.replay[..n].to_vec();
    assert_eq!(verify(&code), 1);
}

#[test]
fn replay_parser_fuzz_lite() {
    let mut g = played_course(1, 1);
    let n = g.replay_encode() as usize;
    let code = g.replay[..n].to_vec();
    assert_eq!(verify(&[]), -1);
    assert_eq!(verify(&vec![b'A'; 4096]), -1);
    let mut bad = code.clone();
    bad[3] = b'!';
    assert_eq!(verify(&bad), -2);
    assert_eq!(verify(&code[..code.len() - 8]), -3);
    let odd = (5..9).find(|t| (code.len() - t) % 4 == 1).unwrap();
    assert_eq!(verify(&code[..code.len() - odd]), -1, "a length of 1 mod 4 is never valid base64");
    let mut raw = [0u8; 384];
    let r = Game::replay_parse(&code, &mut raw) as usize;
    let encode = |raw: &[u8]| {
        let mut t = Box::new(Game::new());
        let mut out = Vec::new();
        let mut i = 0;
        while i < raw.len() {
            let chunk = &raw[i..(i + 3).min(raw.len())];
            let v = (chunk[0] as u32) << 16 | (*chunk.get(1).unwrap_or(&0) as u32) << 8 | *chunk.get(2).unwrap_or(&0) as u32;
            for &sh in [18, 12, 6, 0][..chunk.len() + 1].iter() {
                out.push(B64[(v >> sh & 63) as usize]);
            }
            i += 3;
        }
        t.replay[..out.len()].copy_from_slice(&out);
        out
    };
    let mut m = raw[..r].to_vec();
    m[0] = b'H';
    assert_eq!(verify(&encode(&m)), -4);
    let mut m = raw[..r].to_vec();
    m[1] = 2;
    assert_eq!(verify(&encode(&m)), -5);
    let mut m = raw[..r].to_vec();
    m[6] = 0;
    assert_eq!(verify(&encode(&m)), -6);
    let mut m = raw[..r].to_vec();
    m[6] = 10;
    assert_eq!(verify(&encode(&m)), -6);
    let mut m = raw[..r].to_vec();
    m[7] = 21;
    assert_eq!(verify(&encode(&m)), -6);
    let mut m = raw[..r].to_vec();
    m.extend_from_slice(&[1, 2, 3]);
    assert_eq!(verify(&encode(&m)), -7);
    let mut m = raw[..r].to_vec();
    m[r - 1] ^= 0x80;
    assert_eq!(verify(&encode(&m)), 0, "a wrong hash is reported as differs");
    let mut m = raw[..r].to_vec();
    m[8] ^= 7;
    assert_eq!(verify(&encode(&m)), 0, "a changed shot differs");
    let mut rng = Lcg(23);
    for _ in 0..200 {
        let len = (rng.next() % 600) as usize;
        let s: Vec<u8> = (0..len).map(|_| if rng.next() % 4 == 0 { (rng.next() % 256) as u8 } else { B64[(rng.next() % 64) as usize] }).collect();
        let r = verify(&s);
        assert!(r <= 1, "random input must parse to a code, never panic");
    }
}

// -------------------------------------------------------- 7. release sweeps

fn sweep(seeds: u32) -> ([u32; 6], u32, u32, u32) {
    let mut hist = [0u32; 6];
    let (mut regen, mut fallback, mut shots) = (0, 0, 0);
    for seed in 0..seeds {
        for k in 0..9 {
            let (h, s, p) = prepare(seed, k);
            hist[h.best.max(0) as usize] += 1;
            regen += p.attempt;
            if h.best < 1 {
                fallback += 1;
            }
            shots += s.shots;
        }
    }
    (hist, regen, fallback, shots)
}

fn sweep_stats(hist: &[u32; 6]) -> (u32, u32) {
    let total: u32 = hist.iter().sum();
    let mut acc = 0;
    let mut median = 0;
    for (b, &c) in hist.iter().enumerate() {
        acc += c;
        if acc * 2 >= total {
            median = b as u32;
            break;
        }
    }
    let max = hist.iter().enumerate().filter(|(_, &c)| c > 0).map(|(b, _)| b as u32).max().unwrap_or(0);
    (median, max)
}

#[test]
#[ignore]
fn par_sweep_30_seeds() {
    let t = std::time::Instant::now();
    let (hist, regen, fallback, shots) = sweep(30);
    let (median, max) = sweep_stats(&hist);
    eprintln!("30 seeds x 9 holes: best histogram {hist:?}, {regen} regenerations, {fallback} fallbacks, {shots} solver shots, {:?}", t.elapsed());
    assert_eq!(fallback, 0);
    assert!(regen * 10 <= 270);
    assert!(median >= 2 && median <= 3, "median solver best {median}");
    assert!(max <= 3, "max solver best {max}");
}

fn sha256(data: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut h: [u32; 8] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&((data.len() as u64) * 8).to_be_bytes());
    for chunk in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let mut v = h;
        for i in 0..64 {
            let s1 = v[4].rotate_right(6) ^ v[4].rotate_right(11) ^ v[4].rotate_right(25);
            let ch = (v[4] & v[5]) ^ (!v[4] & v[6]);
            let t1 = v[7].wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = v[0].rotate_right(2) ^ v[0].rotate_right(13) ^ v[0].rotate_right(22);
            let maj = (v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]);
            let t2 = s0.wrapping_add(maj);
            v = [t1.wrapping_add(t2), v[0], v[1], v[2], v[3].wrapping_add(t1), v[4], v[5], v[6]];
        }
        for i in 0..8 {
            h[i] = h[i].wrapping_add(v[i]);
        }
    }
    h.iter().map(|x| format!("{x:08x}")).collect()
}

#[test]
fn sha256_known_answer() {
    assert_eq!(sha256(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
}

/// Bounce + roll-out of the five reference landings on each game surface.
fn landing_table() -> String {
    let mut out = String::new();
    for &(name, v, deg, w) in SHOTS.iter() {
        let f = fly(launch(v, deg, w), 0.0, &AERO);
        for (sname, surf) in [("fairway", FAIR), ("green", GREEN), ("sand", SAND)] {
            let h = flat_hole(79.0, 70.0, surf);
            let mut b = Ball::new();
            b.rest_at(&h, 2.0);
            b.phase = AIR;
            b.x = 2.0;
            b.y = 5.0 + 0.5;
            let (s, c) = f.land_deg.to_radians().sin_cos();
            b.vx = f.land_v * c;
            b.vy = -f.land_v * s;
            b.w = f.land_w;
            while b.moving() && b.bounces == 0 {
                b.step(&h, &AERO);
            }
            let (vt1, w1, hop) = (b.vx, b.w, b.vy.max(0.0));
            let x1 = b.x;
            let (ph, _, ev) = b.run(&h, &AERO);
            let roll = if ph == READY { b.x - x1 } else { f64::NAN };
            let walls = if ev & EV_WALL != 0 { " (hit the end wall)" } else { "" };
            writeln!(out, "| {name} | {sname} | {:.1} / {:.1} / {:.0} | {:.1} | {:.0} | {:.2} | {:.1}{walls} |", f.land_v, f.land_deg, f.land_w / RPM, vt1, w1 / RPM, hop, roll).unwrap();
        }
    }
    out
}

#[test]
#[ignore]
fn write_report() {
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/..");
    let mut r = String::new();
    writeln!(r, "# Report (generated by `cargo test --release -- --ignored write_report`; do not edit)\n").unwrap();
    writeln!(r, "Every number below was produced by the tests in `src/tests.rs` on this build.\n").unwrap();

    writeln!(r, "## Production integrator vs reference\n").unwrap();
    writeln!(r, "Semi-implicit Euler at 120 Hz (the shipped step) against RK4 in f64 at dt = 1/4000 s, same force function, flat ground, no wind.\n").unwrap();
    writeln!(r, "| Shot | Launch | RK4 carry m | Sim carry m | Carry error | RK4 apex m | Sim apex m | RK4 time s | Sim time s |").unwrap();
    writeln!(r, "|---|---|---|---|---|---|---|---|---|").unwrap();
    for (i, (name, sim, rk4)) in reference_table().iter().enumerate() {
        let (_, v, deg, w) = SHOTS[i];
        writeln!(r, "| {name} | {:.1} m/s, {deg} deg, {:.0} rpm | {:.2} | {:.2} | {:+.3} % | {:.2} | {:.2} | {:.3} | {:.3} |", v, w / RPM, rk4.carry, sim.carry, (sim.carry - rk4.carry) / rk4.carry * 100.0, rk4.apex, sim.apex, rk4.time, sim.time).unwrap();
    }

    writeln!(r, "\n## Published tour carries\n").unwrap();
    writeln!(r, "| Shot | Published carry | Sim carry | Error |").unwrap();
    writeln!(r, "|---|---|---|---|").unwrap();
    for (i, yd) in [(0usize, 282.0), (1, 176.0), (2, 142.0)] {
        let (name, v, deg, w) = SHOTS[i];
        let f = fly(launch(v, deg, w), 0.0, &AERO);
        writeln!(r, "| {name} | {yd} yd ({:.1} m) | {:.1} yd ({:.1} m) | {:+.1} % |", yd * YD, f.carry / YD, f.carry, (f.carry - yd * YD) / (yd * YD) * 100.0).unwrap();
    }

    writeln!(r, "\n## Driver landing vs the measured tee shot (Biber et al. 2023, Fig. 3)\n").unwrap();
    let (_, v, deg, w) = SHOTS[0];
    let f = fly(launch(v, deg, w), 0.0, &AERO);
    writeln!(r, "| | Measured | Sim |\n|---|---|---|").unwrap();
    writeln!(r, "| Landing speed | 28.5 m/s | {:.1} m/s |", f.land_v).unwrap();
    writeln!(r, "| Descent angle | 37.3 deg | {:.1} deg |", f.land_deg).unwrap();
    writeln!(r, "| Landing spin | 2094 rpm | {:.0} rpm |", f.land_w / RPM).unwrap();

    writeln!(r, "\n## Game surfaces (tuned, not measured)\n").unwrap();
    writeln!(r, "| Surface | E | MU | Roll decel m/s^2 |\n|---|---|---|---|").unwrap();
    for (name, i) in [("fairway", FAIR), ("sand", SAND), ("green", GREEN)] {
        let s = SURFACES[i as usize];
        writeln!(r, "| {name} | {} | {} | {} |", s.e, s.mu, s.roll_decel).unwrap();
    }
    writeln!(r, "\nEach reference landing through the bounce map and the roll on a flat 79 m strip:\n").unwrap();
    writeln!(r, "| Shot | Surface | Landing v / angle / spin | vt after bounce m/s | Spin after rpm | Hop m/s | Roll-out m |\n|---|---|---|---|---|---|---|").unwrap();
    r.push_str(&landing_table());

    writeln!(r, "\n## Par sweep\n").unwrap();
    let (hist, regen, fallback, shots) = sweep(30);
    let (median, max) = sweep_stats(&hist);
    writeln!(r, "30 seeds x 9 holes = 270 holes, spin setting {SOLVER_SPIN}, {} angles x {} powers.\n", ANGLES.len(), POWERS.len()).unwrap();
    writeln!(r, "| Solver best | Holes |\n|---|---|").unwrap();
    for (b, c) in hist.iter().enumerate() {
        if *c > 0 {
            writeln!(r, "| {b} | {c} |").unwrap();
        }
    }
    writeln!(r, "\nMedian best {median}, max best {max}, {regen} regenerations, {fallback} fallbacks, {shots} solver shots. Par = best + 1.").unwrap();

    writeln!(r, "\n## Build\n").unwrap();
    let wasm = std::fs::read(format!("{root}/public/golf/golf.wasm"));
    match wasm {
        Ok(b) => writeln!(r, "`public/golf/golf.wasm`: {} bytes, SHA-256 `{}`.", b.len(), sha256(&b)).unwrap(),
        Err(_) => writeln!(r, "`public/golf/golf.wasm`: not built yet.").unwrap(),
    }
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/tests.rs")).unwrap();
    // Count attributes on their own line; the quoted forms here do not match themselves.
    let ignored = src.lines().filter(|l| *l == "#[ignore]").count();
    let total = src.lines().filter(|l| *l == "#[test]").count();
    writeln!(r, "\nTests: {} in the default `cargo test`, {ignored} ignored (release).", total - ignored).unwrap();
    std::fs::write(concat!(env!("CARGO_MANIFEST_DIR"), "/REPORT.md"), r).unwrap();

    // The no-JS fallback: the real polyline of today's first hole, in metres, y down.
    let mut h = Hole::new();
    h.generate(20261027, 0, 0);
    let n = h.n as usize;
    let top = h.h[..n].iter().cloned().fold(0.0, f64::max) + 1.0;
    let bottom = h.h[..n].iter().cloned().fold(1e9, f64::min) - 0.5;
    let pts: Vec<String> = (0..n).map(|i| format!("{},{:.2}", i as f64 * SPACING, top - h.h[i])).collect();
    let ts = format!(
        "// Generated by `cargo test --release -- --ignored write_report` in golf/. Do not edit.\n// Seed 20261027, hole 1: the surface polyline in metres, y down, for the no-JS fallback.\nexport const holeViewBox = \"0 0 {} {:.2}\";\nexport const holePoints =\n  \"{}\";\nexport const holeCup = {{ x: {}, y: {:.2} }};\nexport const holeTee = {{ x: {}, y: {:.2} }};\n",
        h.len,
        top - bottom,
        pts.join(" "),
        h.cup_x,
        top - h.cup_y,
        h.tee_x,
        top - h.height(h.tee_x)
    );
    std::fs::create_dir_all(format!("{root}/app/components/golf")).unwrap();
    std::fs::write(format!("{root}/app/components/golf/hole-fallback.ts"), ts).unwrap();
}

