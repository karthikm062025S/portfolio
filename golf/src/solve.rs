//! Breadth-first search over rest positions, resumable in slices, and the
//! generate-solve-regenerate loop that sets par.
use crate::sim::*;

pub const ANGLES: [u32; 25] = [4, 9, 14, 19, 24, 29, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 89, 94, 99, 104, 109, 114, 119, 124];
pub const POWERS: [u32; 8] = [9, 17, 25, 33, 41, 49, 57, 63];
pub const SOLVER_SPIN: u32 = 2;
const NACT: usize = ANGLES.len() * POWERS.len();
const DEPTH_CAP: u8 = 5;
pub const SOLVE_ATTEMPTS: u32 = 8;

pub struct Solver {
    qx: [f64; 64],
    qd: [u8; 64],
    head: usize,
    tail: usize,
    visited: [bool; MAXN],
    act: usize,
    pub done: bool,
    pub best: i32,
    pub shots: u32,
}

impl Solver {
    pub const fn new() -> Self {
        Solver { qx: [0.0; 64], qd: [0; 64], head: 0, tail: 0, visited: [false; MAXN], act: 0, done: false, best: 0, shots: 0 }
    }

    pub fn reset(&mut self, hole: &Hole) {
        *self = Solver::new();
        self.qx[0] = hole.tee_x;
        self.qd[0] = 0;
        self.tail = 1;
        self.visited[(hole.tee_x / SPACING + 0.5) as usize] = true;
    }

    /// A holing shot counts only if its four quantized neighbours (angle +-1,
    /// power +-1) at least finish on the green, so par reflects a player with
    /// 1.4 degree / one power-step jitter, not a lucky grid point.
    fn robust(&mut self, hole: &Hole, x: f64, a: u32, p: u32) -> bool {
        for (da, dp) in [(1i32, 0i32), (-1, 0), (0, 1), (0, -1)] {
            let mut b = Ball::new();
            b.rest_at(hole, x);
            b.shoot((a as i32 + da) as u32, ((p as i32 + dp).max(0).min(63)) as u32, SOLVER_SPIN);
            self.shots += 1;
            let (ph, _, ev) = b.run(hole, &AERO);
            if ev & EV_WALL != 0 || (ph != HOLED && !(ph == READY && hole.surf[hole.seg(b.x)] == GREEN)) {
                return false;
            }
        }
        true
    }

    /// Run up to `max_shots` shots. Returns true when finished (`best` = strokes, 0 = none).
    pub fn slice(&mut self, hole: &Hole, max_shots: u32) -> bool {
        let mut n = 0;
        while !self.done && n < max_shots {
            if self.head >= self.tail {
                self.done = true;
                break;
            }
            if self.act >= NACT {
                self.head += 1;
                self.act = 0;
                continue;
            }
            let d = self.qd[self.head];
            let a = ANGLES[self.act / POWERS.len()];
            let p = POWERS[self.act % POWERS.len()];
            let mut b = Ball::new();
            b.rest_at(hole, self.qx[self.head]);
            b.shoot(a, p, SOLVER_SPIN);
            let (phase, _, ev) = b.run(hole, &AERO);
            self.act += 1;
            n += 1;
            self.shots += 1;
            // The end walls are a game convention: a shot that touches one never sets par.
            if ev & EV_WALL != 0 {
                continue;
            }
            if phase == HOLED && self.robust(hole, self.qx[self.head], a, p) {
                self.best = d as i32 + 1;
                self.done = true;
                break;
            }
            if phase == READY && d + 1 < DEPTH_CAP && self.tail < 64 {
                let cell = (b.x / SPACING + 0.5) as usize;
                if !self.visited[cell] {
                    self.visited[cell] = true;
                    self.qx[self.tail] = b.x;
                    self.qd[self.tail] = d + 1;
                    self.tail += 1;
                }
            }
        }
        self.done
    }
}

/// Generate + solve + regenerate on failure, in slices.
pub struct Prep {
    pub seed: u32,
    pub k: u32,
    pub attempt: u32,
    pub ready: bool,
    /// Test hook: treat the first `force_fail` attempts as unsolvable.
    pub force_fail: u32,
}

impl Prep {
    pub const fn new() -> Self {
        Prep { seed: 0, k: 0, attempt: 0, ready: false, force_fail: 0 }
    }

    pub fn start(&mut self, hole: &mut Hole, solver: &mut Solver, seed: u32, k: u32) {
        self.seed = seed;
        self.k = k;
        self.attempt = 0;
        self.ready = false;
        hole.generate(seed, k, 0);
        solver.reset(hole);
    }

    /// Returns true when the hole is ready (par set).
    pub fn slice(&mut self, hole: &mut Hole, solver: &mut Solver, max_shots: u32) -> bool {
        if self.ready {
            return true;
        }
        let budget_start = solver.shots;
        loop {
            if !solver.slice(hole, max_shots.saturating_sub(solver.shots - budget_start)) {
                return false;
            }
            let m = if self.attempt < self.force_fail { 0 } else { solver.best };
            if (1..=4).contains(&m) {
                hole.best = m;
                hole.par = (m as u32 + 1).max(2).min(5);
                self.ready = true;
                return true;
            }
            self.attempt += 1;
            if self.attempt >= SOLVE_ATTEMPTS {
                hole.best = m;
                hole.par = hole.fallback_par();
                self.ready = true;
                return true;
            }
            let shots = solver.shots;
            hole.generate(self.seed, self.k, self.attempt);
            solver.reset(hole);
            solver.shots = shots;
            if solver.shots - budget_start >= max_shots {
                return false;
            }
        }
    }
}

/// Solver's best first move from `x` on a prepared hole, packed
/// `angle | power << 8 | spin << 14`: the first grid shot that holes, else the
/// one that rests closest to the cup.
pub fn bot_shot(hole: &Hole, x: f64) -> u32 {
    let mut best = (1.0e9f64, 0u32);
    for &a in ANGLES.iter() {
        for &p in POWERS.iter() {
            let mut b = Ball::new();
            b.rest_at(hole, x);
            b.shoot(a, p, SOLVER_SPIN);
            let (ph, _, ev) = b.run(hole, &AERO);
            if ev & EV_WALL != 0 {
                continue;
            }
            let packed = a | p << 8 | SOLVER_SPIN << 14;
            if ph == HOLED {
                return packed;
            }
            let d = abs(b.x - hole.cup_x);
            if ph == READY && d < best.0 {
                best = (d, packed);
            }
        }
    }
    best.1
}
