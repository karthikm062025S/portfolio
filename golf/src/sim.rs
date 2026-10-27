//! Ball flight, bounce, roll and the hole generator. SI units: m, s, kg, rad.
//! Frame: x right, y up, side view. Spin `w > 0` is backspin. Only `+ - * /`
//! and a Newton `sqrt` run inside the step, so native and wasm agree bit for bit.

pub const DT: f64 = 1.0 / 120.0;
pub const FRAME_CLAMP: f64 = 1.0 / 15.0;
pub const MAX_STEPS_PER_FRAME: u32 = 8;
/// A shot ends at this many ticks (20 s) no matter what; the same cap for live
/// play, `settle`, the solver and replay verification.
pub const MAX_SHOT_TICKS: u32 = 2400;

pub const M: f64 = 0.04593; // kg, Rules of Golf maximum mass
pub const R: f64 = 0.02134; // m, 42.67 mm minimum diameter
pub const AREA: f64 = core::f64::consts::PI * R * R;
pub const RHO: f64 = 1.2; // kg/m^3, sea level, about 20 C
pub const G: f64 = 9.81;
pub const K: f64 = RHO * AREA / (2.0 * M);

/// The four fitted aerodynamic constants plus the spin-decay rate (Smits and
/// Smith, as quoted in US 8,795,103). `k` is a field so tests can run a vacuum.
#[derive(Clone, Copy)]
pub struct Aero {
    pub k: f64,
    pub cd0: f64,
    pub cdk: f64,
    pub clmax: f64,
    pub s0: f64,
    pub s_max: f64,
    pub lambda: f64,
}

pub const AERO: Aero = Aero { k: K, cd0: 0.23, cdk: 0.3, clmax: 0.25, s0: 0.05, s_max: 0.6, lambda: 2.0e-5 };
pub const VACUUM: Aero = Aero { k: 0.0, ..AERO };

pub const CUP_R: f64 = 0.054; // 4.25 in hole
pub const V_CAP: f64 = 1.6; // rolling capture speed
pub const LIP_DUMP_V: f64 = 4.0; // below this a rolling miss is kicked to a tap-in
pub const LIP_TAP_V: f64 = 0.5;
pub const LIP_KEEP: f64 = 0.7;
pub const DROP_V: f64 = 12.0; // an air landing centred in the cup holes up to this speed
pub const DROP_TAN: f64 = 0.57735026918962573; // tan 30 deg: minimum descent for a drop-in
pub const V_MAX: f64 = 32.0;
pub const GROUND_VN: f64 = 0.3; // a bounce slower than this normal speed becomes rolling
pub const STOP_V: f64 = 0.05;
pub const STOP_STEPS: u32 = 30;
pub const SNAP_V: f64 = 0.3; // a ball slower than this crossing a valley vertex stops there
pub const E_WALL: f64 = 0.3;
pub const SPACING: f64 = 0.5;
pub const MAXN: usize = 160;

/// Game surfaces: tuned so the model's own landing table rolls out on the scale
/// of the hole. None of these numbers is measured.
#[derive(Clone, Copy)]
pub struct Surface {
    pub e: f64,
    pub mu: f64,
    pub roll_decel: f64,
}
pub const FAIR: u8 = 0;
pub const SAND: u8 = 1;
pub const WATER: u8 = 2;
pub const GREEN: u8 = 3;
pub const SURFACES: [Surface; 4] = [
    Surface { e: 0.30, mu: 0.40, roll_decel: 5.0 },  // fairway
    Surface { e: 0.05, mu: 0.90, roll_decel: 6.0 },  // sand
    Surface { e: 0.30, mu: 0.40, roll_decel: 5.0 },  // water (never reached: splash)
    Surface { e: 0.25, mu: 0.40, roll_decel: 0.55 }, // green: Stimp 10 = 1.83^2 / (2 * 3.048)
];

pub const READY: u32 = 0;
pub const AIR: u32 = 1;
pub const GROUND: u32 = 2;
pub const HOLED: u32 = 3;

pub const EV_LAND: u32 = 1;
pub const EV_LAND_SAND: u32 = 2;
pub const EV_WATER: u32 = 4;
pub const EV_HOLED: u32 = 8;
pub const EV_WALL: u32 = 16;
pub const EV_RIM: u32 = 32;
pub const EV_REST: u32 = 64;
pub const EV_OVER: u32 = 128;

/// sin(i * 90 deg / 64) for i in 0..=64, 17 significant digits.
const SIN: [f64; 65] = [
    0.0000000000000000, 0.024541228522912288, 0.049067674327418015, 0.073564563599667426,
    0.098017140329560604, 0.12241067519921620, 0.14673047445536175, 0.17096188876030122,
    0.19509032201612825, 0.21910124015686980, 0.24298017990326387, 0.26671275747489837,
    0.29028467725446233, 0.31368174039889152, 0.33688985339222005, 0.35989503653498811,
    0.38268343236508978, 0.40524131400498986, 0.42755509343028208, 0.44961132965460654,
    0.47139673682599764, 0.49289819222978404, 0.51410274419322166, 0.53499761988709715,
    0.55557023301960218, 0.57580819141784534, 0.59569930449243336, 0.61523159058062682,
    0.63439328416364549, 0.65317284295377676, 0.67155895484701833, 0.68954054473706683,
    0.70710678118654746, 0.72424708295146689, 0.74095112535495911, 0.75720884650648457,
    0.77301045336273688, 0.78834642762660623, 0.80320753148064483, 0.81758481315158371,
    0.83146961230254524, 0.84485356524970701, 0.85772861000027212, 0.87008699110871135,
    0.88192126434835494, 0.89322430119551532, 0.90398929312344334, 0.91420975570353069,
    0.92387953251128674, 0.93299279883473885, 0.94154406518302081, 0.94952818059303667,
    0.95694033573220894, 0.96377606579543984, 0.97003125319454397, 0.97570213003852857,
    0.98078528040323043, 0.98527764238894122, 0.98917650996478101, 0.99247953459870997,
    0.99518472667219682, 0.99729045667869021, 0.99879545620517241, 0.99969881869620425,
    1.0000000000000000,
];

/// Launch backspin per spin setting: 0 / 1500 / 3000 / 4500 rpm in rad/s.
pub const SPIN: [f64; 4] = [0.0000000000000000, 157.07963267948966, 314.15926535897933, 471.23889803846902];

/// Unit vector for a quantized angle (256 steps per turn, 0 = +x, 64 = up).
pub fn dir(q: u32) -> (f64, f64) {
    let s = |q: u32| -> f64 {
        let q = q & 255;
        let i = (q & 63) as usize;
        match q >> 6 {
            0 => SIN[i],
            1 => SIN[64 - i],
            2 => -SIN[i],
            _ => -SIN[64 - i],
        }
    };
    (s(q.wrapping_add(64)), s(q))
}

/// Launch speed for a power step: `V_MAX * t^1.25` with `t = q / 63`, no `pow`.
pub fn speed(q: u32) -> f64 {
    let t = (q & 63) as f64 / 63.0;
    V_MAX * t * sqrt(sqrt(t))
}

/// Newton's method from a bit-hack seed: pure IEEE ops, so every host agrees.
pub fn sqrt(x: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    let mut y = f64::from_bits((x.to_bits() >> 1) + 0x1ff8_0000_0000_0000);
    for _ in 0..5 {
        y = 0.5 * (y + x / y);
    }
    y
}

pub fn abs(x: f64) -> f64 {
    if x < 0.0 { -x } else { x }
}

pub fn floor_i(x: f64) -> i32 {
    let i = x as i32;
    if (i as f64) > x { i - 1 } else { i }
}

pub fn hash32(mut x: u32) -> u32 {
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb_352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846c_a68b);
    x ^= x >> 16;
    x
}

pub fn hash2(a: u32, b: u32) -> u32 {
    hash32(a ^ hash32(b.wrapping_add(0x9e37_79b9)))
}

pub fn unit(h: u32) -> f64 {
    (h >> 8) as f64 / 16_777_216.0
}

/// Aerodynamic acceleration (no gravity) and spin decay for relative air
/// velocity `(ux, uy)` and spin `w`. Odd in the spin ratio: topspin pushes down.
pub fn accel(p: &Aero, ux: f64, uy: f64, w: f64) -> (f64, f64, f64) {
    let u = sqrt(ux * ux + uy * uy);
    if u < 1e-9 {
        return (0.0, 0.0, 0.0);
    }
    let mut s = w * R / u;
    if s > p.s_max {
        s = p.s_max;
    } else if s < -p.s_max {
        s = -p.s_max;
    }
    let cd = p.cd0 + p.cdk * s * s;
    let cl = p.clmax * s / (abs(s) + p.s0);
    let ku = p.k * u;
    (-ku * (cd * ux + cl * uy), -ku * (cd * uy - cl * ux), -p.lambda * (u / R) * w)
}

#[repr(C)]
pub struct Hole {
    pub n: u32,
    pub len: f64,
    pub tee_x: f64,
    pub cup_x: f64,
    pub cup_y: f64,
    pub water_y: f64,
    pub wind: f64,
    pub par: u32,
    pub best: i32,
    pub h: [f64; MAXN],
    pub surf: [u8; MAXN],
}

impl Hole {
    pub const fn new() -> Self {
        Hole { n: 0, len: 0.0, tee_x: 0.0, cup_x: 0.0, cup_y: 0.0, water_y: 0.0, wind: 0.0, par: 0, best: 0, h: [0.0; MAXN], surf: [0; MAXN] }
    }

    /// Segment index under `x`, clamped into the hole.
    pub fn seg(&self, x: f64) -> usize {
        floor_i(x / SPACING).max(0).min(self.n as i32 - 2) as usize
    }

    /// Height of segment `i`'s line at `x` (extrapolates past its ends).
    pub fn seg_height(&self, i: usize, x: f64) -> f64 {
        self.h[i] + (self.h[i + 1] - self.h[i]) * (x / SPACING - i as f64)
    }

    pub fn height(&self, x: f64) -> f64 {
        let i = self.seg(x);
        let t = (x / SPACING - i as f64).max(0.0).min(1.0);
        self.h[i] + (self.h[i + 1] - self.h[i]) * t
    }

    /// Unit tangent of segment `i`, pointing +x.
    pub fn tangent(&self, i: usize) -> (f64, f64) {
        let dy = self.h[i + 1] - self.h[i];
        let l = sqrt(SPACING * SPACING + dy * dy);
        (SPACING / l, dy / l)
    }

    pub fn is_valley(&self, i: usize) -> bool {
        i > 0 && (i as u32) < self.n - 1 && self.h[i - 1] > self.h[i] && self.h[i + 1] > self.h[i]
    }

    /// 1D value noise, 2 octaves, smoothstep interpolation.
    fn noise(seed: u32, x: f64) -> f64 {
        let mut v = 0.0;
        for (o, (wl, amp)) in [(12.0f64, 1.0f64), (4.5, 0.35)].iter().enumerate() {
            let p = x / wl;
            let k = floor_i(p);
            let t = p - k as f64;
            let t = t * t * (3.0 - 2.0 * t);
            let a = unit(hash2(seed ^ (o as u32 * 0x5bd1_e995), k as u32)) * 2.0 - 1.0;
            let b = unit(hash2(seed ^ (o as u32 * 0x5bd1_e995), (k + 1) as u32)) * 2.0 - 1.0;
            v += (a + (b - a) * t) * amp;
        }
        v
    }

    /// Generate hole `k` (0-based; difficulty walks a 9-step curve) of `seed`,
    /// `attempt` picks a different layout when the solver rejects one.
    pub fn generate(&mut self, seed: u32, k: u32, attempt: u32) {
        const CURVE: [f64; 9] = [0.2, 0.3, 0.4, 0.55, 0.65, 0.75, 0.85, 0.95, 1.0];
        let d = (k % 9) as usize;
        let s = hash2(hash2(seed, k), attempt);
        let scale = CURVE[d];
        let len = 20.0 + 30.0 * (0.25 + 0.75 * d as f64 / 8.0) * (0.7 + 0.3 * unit(hash2(s, 1)));
        let len = (len * 2.0 + 0.5) as u32 as f64 * 0.5;
        let n = (len / SPACING) as usize + 1;
        self.n = n as u32;
        self.len = len;
        let amp = 1.6 * scale;
        for i in 0..n {
            self.h[i] = 6.0 + Self::noise(s, i as f64 * SPACING) * amp;
            self.surf[i] = FAIR;
        }
        // Plateaus: tee (first 3 m) and cup (4 m centred), blended over 2 m.
        let cup_x = len * (0.7 + 0.2 * unit(hash2(s, 2)));
        let cup_x = (cup_x * 2.0) as u32 as f64 * 0.5;
        let tee_y = self.h[6];
        let cup_y = self.height(cup_x);
        let blend = |h: &mut [f64], from: usize, to: usize, y: f64| {
            for i in from..to.min(n) {
                h[i] = y;
            }
        };
        blend(&mut self.h, 0, 7, tee_y);
        let ci = (cup_x / SPACING) as usize;
        blend(&mut self.h, ci.saturating_sub(4), ci + 5, cup_y);
        for (edge, y, sign) in [(6usize, tee_y, 1i32), (ci.saturating_sub(4), cup_y, -1), (ci + 4, cup_y, 1)] {
            for j in 1..=4usize {
                let i = edge as i32 + sign * j as i32;
                if i < 0 || i as usize >= n {
                    continue;
                }
                let t = j as f64 / 5.0;
                let t = t * t * (3.0 - 2.0 * t);
                let i = i as usize;
                self.h[i] = y + (self.h[i] - y) * t;
            }
        }
        // Slope clamp (two passes each way).
        const LIM: f64 = 0.2;
        for _ in 0..2 {
            for i in 1..n {
                let lim = self.h[i - 1] + LIM;
                if self.h[i] > lim {
                    self.h[i] = lim;
                }
                let lim = self.h[i - 1] - LIM;
                if self.h[i] < lim {
                    self.h[i] = lim;
                }
            }
            for i in (0..n - 1).rev() {
                let lim = self.h[i + 1] + LIM;
                if self.h[i] > lim {
                    self.h[i] = lim;
                }
                let lim = self.h[i + 1] - LIM;
                if self.h[i] < lim {
                    self.h[i] = lim;
                }
            }
        }
        // Keep everything above the floor.
        let mut min = 1000.0f64;
        for i in 0..n {
            if self.h[i] < min {
                min = self.h[i];
            }
        }
        if min < 3.0 {
            for i in 0..n {
                self.h[i] += 3.0 - min;
            }
        }
        self.tee_x = 1.5;
        self.cup_x = cup_x;
        self.cup_y = self.h[ci];
        self.water_y = 0.0;
        for i in ci.saturating_sub(4)..(ci + 5).min(n) {
            self.surf[i] = GREEN;
        }
        self.wind = (hash2(s, 7) % 13) as f64 - 6.0;
        // Sand from hole 3, water from hole 6; never on the tee or cup plateaus.
        let lo = 8usize;
        let hi = ci.saturating_sub(5);
        if d >= 2 && hi > lo + 14 {
            let patches = hash2(s, 3) % 3;
            for p in 0..patches {
                let w = 4 + (hash2(s, 10 + p) % 5) as usize;
                let at = lo + (hash2(s, 20 + p) as usize % (hi - lo - w));
                for i in at..at + w {
                    self.surf[i] = SAND;
                }
            }
        }
        if d >= 5 && hi > lo + 16 {
            let w = 6 + (hash2(s, 4) % 5) as usize;
            let at = lo + 2 + (hash2(s, 5) as usize % (hi - lo - w - 4));
            let rim = if self.h[at] < self.h[at + w] { self.h[at] } else { self.h[at + w] };
            self.water_y = rim - 0.15;
            for i in at..=at + w {
                let t = (i - at) as f64 / w as f64;
                let dip = 1.2 * (1.0 - (2.0 * t - 1.0) * (2.0 * t - 1.0));
                self.h[i] -= dip;
                if i > at && i < at + w {
                    self.surf[i] = WATER;
                }
            }
            self.surf[at] = WATER;
        }
        self.par = 0;
        self.best = 0;
    }

    pub fn fallback_par(&self) -> u32 {
        2 + (self.len / 25.0) as u32
    }

    pub fn min_h(&self) -> f64 {
        let mut min = 1000.0f64;
        for i in 0..self.n as usize {
            if self.h[i] < min {
                min = self.h[i];
            }
        }
        min
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct Ball {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub w: f64,
    pub phase: u32,
    pub still: u32,
    pub ticks: u32,
    pub bounces: u32,
    pub last_x: f64,
}

impl Ball {
    pub const fn new() -> Self {
        Ball { x: 0.0, y: 0.0, vx: 0.0, vy: 0.0, w: 0.0, phase: READY, still: 0, ticks: 0, bounces: 0, last_x: 0.0 }
    }

    pub fn rest_at(&mut self, hole: &Hole, x: f64) {
        self.x = x;
        self.y = hole.height(x);
        self.vx = 0.0;
        self.vy = 0.0;
        self.w = 0.0;
        self.phase = READY;
        self.still = 0;
        self.ticks = 0;
        self.last_x = x;
    }

    pub fn shoot(&mut self, angle_q: u32, power_q: u32, spin_q: u32) -> bool {
        if self.phase != READY || angle_q > 255 || power_q > 63 || spin_q > 3 {
            return false;
        }
        let (dx, dy) = dir(angle_q);
        let v = speed(power_q);
        self.vx = dx * v;
        self.vy = dy * v;
        self.w = SPIN[spin_q as usize];
        self.phase = AIR;
        self.still = 0;
        self.ticks = 0;
        self.bounces = 0;
        true
    }

    pub fn moving(&self) -> bool {
        self.phase == AIR || self.phase == GROUND
    }

    /// One fixed step. Returns event flags.
    pub fn step(&mut self, hole: &Hole, aero: &Aero) -> u32 {
        if !self.moving() {
            return 0;
        }
        self.ticks += 1;
        if self.ticks > MAX_SHOT_TICKS {
            let x = self.x;
            self.rest_at(hole, x);
            return EV_REST;
        }
        let ev = if self.phase == AIR { self.air_step(hole, aero) } else { self.ground_step(hole, aero) };
        if self.moving() && self.y < -5.0 {
            return ev | self.splash(hole);
        }
        ev
    }

    /// Semi-implicit Euler velocity update for one tick of free flight.
    pub fn kick(&mut self, wind: f64, aero: &Aero) {
        let (ax, ay, dw) = accel(aero, self.vx - wind, self.vy, self.w);
        self.vx += ax * DT;
        self.vy += (ay - G) * DT;
        self.w += dw * DT;
    }

    fn air_step(&mut self, hole: &Hole, aero: &Aero) -> u32 {
        self.kick(hole.wind, aero);
        let mut ev = 0;
        let mut left = DT;
        let mut rounds = 0;
        while left > 0.0 && self.phase == AIR && rounds < 8 {
            rounds += 1;
            let x0 = self.x;
            let y0 = self.y;
            let mut x1 = x0 + self.vx * left;
            let y1 = y0 + self.vy * left;
            // Invisible end walls (a game convention, not physics).
            if x1 < 0.0 {
                x1 = 0.0;
                if self.vx < 0.0 {
                    self.vx = -self.vx * E_WALL;
                    ev |= EV_WALL;
                }
            } else if x1 > hole.len {
                x1 = hole.len;
                if self.vx > 0.0 {
                    self.vx = -self.vx * E_WALL;
                    ev |= EV_WALL;
                }
            }
            match Self::sweep(hole, x0, y0, x1, y1) {
                None => {
                    self.x = x1;
                    self.y = y1;
                    left = 0.0;
                }
                Some((f, i)) => {
                    self.x = x0 + (x1 - x0) * f;
                    self.y = hole.seg_height(i, self.x);
                    left *= 1.0 - f;
                    if hole.surf[i] == WATER {
                        return ev | self.splash(hole);
                    }
                    ev |= self.bounce(hole, i);
                }
            }
        }
        if self.phase == AIR && hole.surf[hole.seg(self.x)] == WATER && self.y < hole.water_y {
            return ev | self.splash(hole);
        }
        ev
    }

    /// First crossing of the terrain polyline by the moving point from
    /// `(x0, y0)` to `(x1, y1)`: the fraction of the move and the segment hit.
    /// Exact for a line: the gap to the surface is piecewise linear in the fraction.
    fn sweep(hole: &Hole, x0: f64, y0: f64, x1: f64, y1: f64) -> Option<(f64, usize)> {
        let dx = x1 - x0;
        let dy = y1 - y0;
        let last = hole.n as i32 - 2;
        let mut i = hole.seg(x0) as i32;
        let mut fa = 0.0;
        let mut da = y0 - hole.seg_height(i as usize, x0);
        let step = if dx > 0.0 { 1 } else { -1 };
        loop {
            let xv = if dx > 0.0 { (i + 1) as f64 * SPACING } else { i as f64 * SPACING };
            let fv = if dx == 0.0 { 1.0 } else { (xv - x0) / dx };
            let (fb, end) = if fv >= 1.0 || (step > 0 && i >= last) || (step < 0 && i <= 0) { (1.0, true) } else { (fv, false) };
            let xb = x0 + dx * fb;
            let yb = y0 + dy * fb;
            let db = yb - hole.seg_height(i as usize, xb);
            // A start within 1e-9 below the line (rounding after a bounce at a vertex) still counts as on it.
            if da >= -1e-9 && db < 0.0 && db < da {
                let f = if da > 0.0 { fa + (fb - fa) * da / (da - db) } else { fa };
                return Some((f, i as usize));
            }
            if end {
                return None;
            }
            fa = fb;
            da = db;
            i += step;
        }
    }

    /// Rigid bounce with Coulomb friction (Biber et al. 2023, eq. 5) at the
    /// crossing on segment `i`. The ball is on the surface when this runs.
    fn bounce(&mut self, hole: &Hole, i: usize) -> u32 {
        let (tx, ty) = hole.tangent(i);
        let (nx, ny) = (-ty, tx);
        let mut vn = self.vx * nx + self.vy * ny;
        let mut vt = self.vx * tx + self.vy * ty;
        if vn >= 0.0 {
            return 0;
        }
        let mut ev = 0;
        self.bounces += 1;
        let surf = hole.surf[i];
        let sp = SURFACES[surf as usize];
        if surf == GREEN {
            let miss = abs(self.x - hole.cup_x);
            let v = sqrt(self.vx * self.vx + self.vy * self.vy);
            if miss <= CUP_R - R && -self.vy > DROP_TAN * abs(self.vx) && v <= DROP_V {
                self.hole_out(hole);
                return EV_HOLED;
            }
            if miss <= CUP_R {
                vn *= LIP_KEEP;
                vt *= LIP_KEEP;
                ev |= EV_RIM;
            }
        }
        if self.bounces == 1 {
            ev |= if surf == SAND { EV_LAND_SAND } else { EV_LAND };
        }
        let c = vt + self.w * R;
        let j = sp.mu * (1.0 + sp.e) * -vn;
        if abs(c) > 3.5 * j {
            let sg = if c > 0.0 { 1.0 } else { -1.0 };
            vt -= j * sg;
            self.w -= 2.5 * j * sg / R;
        } else {
            vt = (5.0 / 7.0) * vt - (2.0 / 7.0) * self.w * R;
            self.w = -vt / R;
        }
        if surf == SAND {
            self.w = 0.0;
        }
        let vn2 = -sp.e * vn;
        if vn2 < GROUND_VN {
            self.phase = GROUND;
            self.vx = vt * tx;
            self.vy = vt * ty;
            self.still = 0;
        } else {
            self.vx = vt * tx + vn2 * nx;
            self.vy = vt * ty + vn2 * ny;
        }
        ev
    }

    fn hole_out(&mut self, hole: &Hole) {
        self.x = hole.cup_x;
        self.y = hole.cup_y;
        self.vx = 0.0;
        self.vy = 0.0;
        self.w = 0.0;
        self.phase = HOLED;
    }

    /// Rolling along the polyline: gravity along the tangent, a constant rolling
    /// deceleration, the aerodynamic force projected on the tangent.
    fn ground_step(&mut self, hole: &Hole, aero: &Aero) -> u32 {
        let mut ev = 0;
        let i = hole.seg(self.x);
        let (tx, ty) = hole.tangent(i);
        let surf = hole.surf[i];
        let sp = SURFACES[surf as usize];
        let mut vt = self.vx * tx + self.vy * ty;
        let (ax, ay, _) = accel(aero, self.vx - hole.wind, self.vy, self.w);
        let at_vertex = abs(self.x - i as f64 * SPACING) < 1e-9 && hole.is_valley(i);
        let drive = if at_vertex && vt == 0.0 { 0.0 } else { -G * ty + ax * tx + ay * ty };
        let holdable = abs(drive) <= sp.roll_decel;
        if vt == 0.0 && holdable {
            // Rolling resistance holds the ball.
        } else {
            let v1 = vt + drive * DT;
            let dec = sp.roll_decel * DT;
            vt = if v1 > dec {
                v1 - dec
            } else if v1 < -dec {
                v1 + dec
            } else {
                0.0
            };
        }
        let x0 = self.x;
        let mut x1 = x0 + vt * tx * DT;
        if x1 < 0.0 {
            x1 = 0.0;
            vt = -vt * E_WALL;
            ev |= EV_WALL;
        } else if x1 > hole.len {
            x1 = hole.len;
            vt = -vt * E_WALL;
            ev |= EV_WALL;
        }
        // Cup: crossing the centre on the ground.
        if (x0 - hole.cup_x) * (x1 - hole.cup_x) <= 0.0 && x0 != x1 && surf == GREEN {
            let v = abs(vt);
            if v < V_CAP {
                self.hole_out(hole);
                return ev | EV_HOLED;
            }
            let sg = if vt > 0.0 { 1.0 } else { -1.0 };
            vt = if v < LIP_DUMP_V { LIP_TAP_V * sg } else { vt * LIP_KEEP };
            ev |= EV_RIM;
        }
        // Valley vertex: a slow ball crossing it stops there (a polyline has no flat bottom).
        let j = hole.seg(x1);
        if j != i && abs(vt) < SNAP_V {
            let v = if x1 > x0 { i + 1 } else { i };
            if hole.is_valley(v) {
                x1 = v as f64 * SPACING;
                vt = 0.0;
            }
        }
        // Lift-off: the free path stays above the surface where it falls away.
        let y_free = self.y + vt * ty * DT - 0.5 * G * DT * DT;
        let y_surf = hole.height(x1);
        self.x = x1;
        if y_free > y_surf + 1e-6 {
            self.y = y_free;
            self.vx = vt * tx;
            self.vy = vt * ty - G * DT;
            self.w = -vt / R;
            self.phase = AIR;
            self.still = 0;
            return ev;
        }
        self.y = y_surf;
        let j = hole.seg(x1);
        let (tx2, ty2) = hole.tangent(j);
        self.vx = vt * tx2;
        self.vy = vt * ty2;
        self.w = -vt / R;
        if hole.surf[j] == WATER && self.y < hole.water_y {
            return ev | self.splash(hole);
        }
        let drive2 = -G * ty2;
        let at_vertex2 = abs(self.x - j as f64 * SPACING) < 1e-9 && hole.is_valley(j);
        let hold2 = at_vertex2 || abs(drive2) <= SURFACES[hole.surf[j] as usize].roll_decel;
        if abs(vt) < STOP_V && hold2 {
            self.still += 1;
        } else {
            self.still = 0;
        }
        if self.still >= STOP_STEPS {
            let x = self.x;
            self.rest_at(hole, x);
            return ev | EV_REST;
        }
        ev
    }

    fn splash(&mut self, hole: &Hole) -> u32 {
        let x = self.last_x;
        self.rest_at(hole, x);
        EV_WATER
    }

    /// Run a shot to its end. Returns (final phase, steps, events).
    pub fn run(&mut self, hole: &Hole, aero: &Aero) -> (u32, u32, u32) {
        let mut n = 0;
        let mut ev = 0;
        while self.moving() {
            ev |= self.step(hole, aero);
            n += 1;
        }
        (self.phase, n, ev)
    }
}
