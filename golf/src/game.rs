//! One course of nine holes: fixed-step advance, the chained state hash, the
//! shot log and the replay code. Everything the wasm exports is a one-line
//! wrapper over a `Game`.
use crate::sim::*;
use crate::solve::*;

pub const HOLES: usize = 9;
pub const MAX_SHOTS: usize = 20;
pub const NVIEW: usize = 16;
pub const NPREVIEW: usize = 128;
pub const PREVIEW_TICKS: usize = 48;
pub const REPLAY_BUF: usize = 512;

const FNV_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

pub const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

pub struct Game {
    pub seed: u32,
    pub cur: Hole,
    pub next: Hole,
    pub ball: Ball,
    pub solver: Solver,
    pub prep: Prep,
    pub strokes: u32,
    pub k: u32,
    pub playing: bool,
    pub acc: f64,
    pub hash: u64,
    /// The hash as the playing hole started; a restart rewinds to it so a
    /// discarded attempt never reaches the chain the replay reproduces.
    pub hole_hash0: u64,
    pub shot_ev: u32,
    pub holes_done: u32,
    pub total_strokes: u32,
    pub total_par: u32,
    pub hole_hash: [u64; HOLES],
    pub log: [[u8; 2 * MAX_SHOTS]; HOLES],
    pub nshots: [u8; HOLES],
    pub view: [f64; NVIEW],
    pub preview: [f64; NPREVIEW],
    pub preview_n: u32,
    pub tele: [u32; 4],
    pub replay: [u8; REPLAY_BUF],
    pub replay_seed: u32,
    pub replay_summary: [u32; 3],
}

impl Game {
    pub const fn new() -> Self {
        Game {
            seed: 0,
            cur: Hole::new(),
            next: Hole::new(),
            ball: Ball::new(),
            solver: Solver::new(),
            prep: Prep::new(),
            strokes: 0,
            k: 0,
            playing: false,
            acc: 0.0,
            hash: 0,
            hole_hash0: 0,
            shot_ev: 0,
            holes_done: 0,
            total_strokes: 0,
            total_par: 0,
            hole_hash: [0; HOLES],
            log: [[0; 2 * MAX_SHOTS]; HOLES],
            nshots: [0; HOLES],
            view: [0.0; NVIEW],
            preview: [0.0; NPREVIEW],
            preview_n: 0,
            tele: [0; 4],
            replay: [0; REPLAY_BUF],
            replay_seed: 0,
            replay_summary: [0; 3],
        }
    }

    pub fn new_course(&mut self, seed: u32) {
        self.seed = seed;
        self.cur = Hole::new();
        self.next = Hole::new();
        self.ball = Ball::new();
        self.solver = Solver::new();
        self.prep = Prep::new();
        self.strokes = 0;
        self.k = 0;
        self.playing = false;
        self.acc = 0.0;
        self.hash = FNV_BASIS;
        self.shot_ev = 0;
        self.holes_done = 0;
        self.total_strokes = 0;
        self.total_par = 0;
        self.hole_hash = [0; HOLES];
        self.nshots = [0; HOLES];
        self.tele = [0; 4];
        self.sync();
    }

    fn feed(&mut self, bytes: &[u8]) {
        for &b in bytes {
            self.hash ^= b as u64;
            self.hash = self.hash.wrapping_mul(FNV_PRIME);
        }
    }

    fn feed_f64(&mut self, v: f64) {
        self.feed(&v.to_bits().to_le_bytes());
    }

    fn feed_u32(&mut self, v: u32) {
        self.feed(&v.to_le_bytes());
    }

    pub fn hole_prepare(&mut self, k: u32) {
        if k as usize >= HOLES {
            return;
        }
        self.prep.start(&mut self.next, &mut self.solver, self.seed, k);
    }

    pub fn hole_solve(&mut self, max_shots: u32) -> i32 {
        if self.next.n == 0 {
            return -1;
        }
        if self.prep.slice(&mut self.next, &mut self.solver, max_shots) { self.next.par as i32 } else { -1 }
    }

    pub fn hole_start(&mut self) -> u32 {
        if !self.prep.ready || self.holes_done as usize >= HOLES {
            return 0;
        }
        self.cur = Hole { ..self.next };
        self.k = self.prep.k;
        self.playing = true;
        let n = self.cur.n as usize;
        for i in 0..n {
            let h = self.cur.h[i];
            self.feed_f64(h);
            let s = self.cur.surf[i];
            self.feed(&[s]);
        }
        self.feed_u32(self.cur.par);
        let wind = self.cur.wind;
        self.feed_f64(wind);
        self.hole_hash0 = self.hash;
        self.prep.ready = false;
        self.restart();
        1
    }

    pub fn restart(&mut self) {
        if !self.playing {
            return;
        }
        let x = self.cur.tee_x;
        self.ball.rest_at(&self.cur, x);
        self.strokes = 0;
        self.acc = 0.0;
        self.shot_ev = 0;
        self.hash = self.hole_hash0;
        self.nshots[self.holes_done as usize] = 0;
        self.sync();
    }

    pub fn shoot(&mut self, angle_q: u32, power_q: u32, spin_q: u32) -> u32 {
        if !self.playing || self.strokes >= MAX_SHOTS as u32 || !self.ball.shoot(angle_q, power_q, spin_q) {
            return 0;
        }
        self.strokes += 1;
        self.shot_ev = 0;
        self.tele[3] += 1;
        let h = self.holes_done as usize;
        let n = self.nshots[h] as usize;
        self.log[h][2 * n] = angle_q as u8;
        self.log[h][2 * n + 1] = ((spin_q << 6) | power_q) as u8;
        self.nshots[h] += 1;
        self.sync();
        1
    }

    fn tick(&mut self) -> u32 {
        let mut e = self.ball.step(&self.cur, &AERO);
        self.tele[2] += 1;
        if e & EV_WATER != 0 {
            self.strokes += 1;
        }
        self.shot_ev |= e;
        if !self.ball.moving() {
            let b = self.ball;
            self.feed_f64(b.x);
            self.feed_f64(b.y);
            self.feed_f64(b.vx);
            self.feed_f64(b.vy);
            self.feed_f64(b.w);
            self.feed_u32(self.strokes);
            self.feed_u32(self.shot_ev);
            if b.phase != HOLED && self.strokes >= MAX_SHOTS as u32 {
                self.ball.phase = HOLED;
                e |= EV_OVER;
            }
            if self.ball.phase == HOLED {
                self.holes_done += 1;
                self.total_strokes += self.strokes;
                self.total_par += self.cur.par;
                self.hole_hash[self.holes_done as usize - 1] = self.hash;
                self.playing = false;
            }
        }
        e
    }

    /// Advance by `dt_ms` of wall time in fixed steps. Returns the event bits.
    pub fn advance(&mut self, dt_ms: f64) -> u32 {
        if !self.ball.moving() {
            self.acc = 0.0;
            return 0;
        }
        let mut dt = if dt_ms > 0.0 { dt_ms * 0.001 } else { 0.0 };
        if dt > FRAME_CLAMP {
            self.tele[0] += 1;
            self.tele[1] += ((dt - FRAME_CLAMP) / DT) as u32;
            dt = FRAME_CLAMP;
        }
        self.acc += dt;
        let mut ev = 0;
        let mut n = 0;
        while self.acc >= DT && n < MAX_STEPS_PER_FRAME {
            self.acc -= DT;
            n += 1;
            ev |= self.tick();
            if !self.ball.moving() {
                self.acc = 0.0;
                break;
            }
        }
        if self.acc >= DT {
            self.tele[1] += (self.acc / DT) as u32;
            self.acc = 0.0;
        }
        self.sync();
        ev
    }

    /// Run the current shot to its end with the same step function.
    pub fn settle(&mut self) -> u32 {
        let mut ev = 0;
        while self.ball.moving() {
            ev |= self.advance(1000.0 * DT * MAX_STEPS_PER_FRAME as f64);
        }
        ev
    }

    pub fn preview(&mut self, angle_q: u32, power_q: u32, spin_q: u32) {
        self.preview_n = 0;
        if !self.playing || self.cur.n == 0 {
            return;
        }
        let mut b = self.ball;
        if !b.shoot(angle_q, power_q, spin_q) {
            return;
        }
        for i in 0..PREVIEW_TICKS {
            b.step(&self.cur, &AERO);
            self.preview[2 * i] = b.x;
            self.preview[2 * i + 1] = b.y;
            self.preview_n = i as u32 + 1;
            if !b.moving() {
                break;
            }
        }
    }

    pub fn bot_shot(&self) -> u32 {
        if !self.playing || self.ball.phase != READY {
            return 0;
        }
        bot_shot(&self.cur, self.ball.x)
    }

    pub fn sync(&mut self) {
        let b = &self.ball;
        let h = &self.cur;
        self.view = [
            b.x,
            b.y,
            b.vx,
            b.vy,
            b.w,
            b.phase as f64,
            self.strokes as f64,
            h.par as f64,
            h.wind,
            h.len,
            h.cup_x,
            h.n as f64,
            self.k as f64,
            self.holes_done as f64,
            self.total_strokes as f64,
            self.total_par as f64,
        ];
    }

    // ------------------------------------------------------------ replay code

    /// Write the base64url code of the completed holes into the replay buffer.
    pub fn replay_encode(&mut self) -> u32 {
        let mut raw = [0u8; 384];
        let mut n = 0;
        raw[0] = b'G';
        raw[1] = 1;
        raw[2..6].copy_from_slice(&self.seed.to_le_bytes());
        raw[6] = self.holes_done as u8;
        n += 7;
        for h in 0..self.holes_done as usize {
            let s = self.nshots[h] as usize;
            raw[n] = s as u8;
            n += 1;
            raw[n..n + 2 * s].copy_from_slice(&self.log[h][..2 * s]);
            n += 2 * s;
        }
        let tail = if self.holes_done == 0 { 0 } else { self.hole_hash[self.holes_done as usize - 1] as u32 };
        raw[n..n + 4].copy_from_slice(&tail.to_le_bytes());
        n += 4;
        let mut out = 0;
        let mut i = 0;
        while i < n {
            let b0 = raw[i] as u32;
            let b1 = if i + 1 < n { raw[i + 1] as u32 } else { 0 };
            let b2 = if i + 2 < n { raw[i + 2] as u32 } else { 0 };
            let v = b0 << 16 | b1 << 8 | b2;
            let chars = [18, 12, 6, 0];
            let count = (n - i).min(3) + 1;
            for &sh in chars[..count].iter() {
                self.replay[out] = B64[(v >> sh & 63) as usize];
                out += 1;
            }
            i += 3;
        }
        out as u32
    }

    /// Parse the buffer as untrusted input. Returns the number of raw bytes, or a
    /// negative code: -1 empty or too long, -2 bad character, -3 bad length,
    /// -4 bad magic, -5 bad version, -6 hole or shot count out of range,
    /// -7 trailing bytes.
    pub fn replay_parse(buf: &[u8], raw: &mut [u8; 384]) -> i32 {
        let len = buf.len();
        if len == 0 || len > REPLAY_BUF || len % 4 == 1 {
            return -1;
        }
        let mut n = 0;
        let mut acc = 0u32;
        let mut bits = 0;
        for &c in buf {
            let v = match c {
                b'A'..=b'Z' => c - b'A',
                b'a'..=b'z' => c - b'a' + 26,
                b'0'..=b'9' => c - b'0' + 52,
                b'-' => 62,
                b'_' => 63,
                _ => return -2,
            };
            acc = acc << 6 | v as u32;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                if n >= raw.len() {
                    return -3;
                }
                raw[n] = (acc >> bits) as u8;
                n += 1;
            }
        }
        if n < 11 {
            return -3;
        }
        if raw[0] != b'G' {
            return -4;
        }
        if raw[1] != 1 {
            return -5;
        }
        let holes = raw[6] as usize;
        if holes == 0 || holes > HOLES {
            return -6;
        }
        let mut p = 7;
        for _ in 0..holes {
            if p >= n {
                return -3;
            }
            let s = raw[p] as usize;
            if s > MAX_SHOTS {
                return -6;
            }
            p += 1 + 2 * s;
        }
        if p + 4 > n {
            return -3;
        }
        if p + 4 < n {
            return -7;
        }
        n as i32
    }

    /// Re-simulate a parsed code on this (separate) instance. 1 match, 0 differs.
    pub fn replay_verify(&mut self, raw: &[u8], n: usize) -> i32 {
        let seed = u32::from_le_bytes([raw[2], raw[3], raw[4], raw[5]]);
        let holes = raw[6] as usize;
        self.new_course(seed);
        self.replay_seed = seed;
        let mut p = 7;
        for k in 0..holes {
            self.hole_prepare(k as u32);
            while self.hole_solve(1 << 20) < 0 {}
            if self.hole_start() == 0 {
                return 0;
            }
            let s = raw[p] as usize;
            p += 1;
            for _ in 0..s {
                let a = raw[p] as u32;
                let b = raw[p + 1] as u32;
                p += 2;
                if self.shoot(a, b & 63, b >> 6) == 0 {
                    return 0;
                }
                self.settle();
            }
            if self.playing {
                return 0;
            }
        }
        self.replay_summary = [self.holes_done, self.total_strokes, self.total_par];
        let want = u32::from_le_bytes([raw[n - 4], raw[n - 3], raw[n - 2], raw[n - 1]]);
        if self.hole_hash[holes - 1] as u32 == want { 1 } else { 0 }
    }
}
