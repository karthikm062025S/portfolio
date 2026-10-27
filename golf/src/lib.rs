//! Side-view golf: a deterministic, real-unit ball flight over a heightfield,
//! a seeded hole generator and a breadth-first solver that sets par. No
//! dependencies, no allocator, no transcendental functions inside the sim, so
//! the same quantized inputs replay bit for bit on native and in wasm.
#![cfg_attr(not(test), no_std)]

pub mod game;
pub mod sim;
pub mod solve;

#[cfg(test)]
mod tests;

use game::Game;

static mut GAME: Game = Game::new();
static mut VERIFY: Game = Game::new();

#[allow(static_mut_refs)]
fn g() -> &'static mut Game {
    unsafe { &mut GAME }
}

#[allow(static_mut_refs)]
fn v() -> &'static mut Game {
    unsafe { &mut VERIFY }
}

#[no_mangle]
pub extern "C" fn new_course(seed: u32) {
    g().new_course(seed)
}
#[no_mangle]
pub extern "C" fn hole_prepare(k: u32) {
    g().hole_prepare(k)
}
#[no_mangle]
pub extern "C" fn hole_solve(max_shots: u32) -> i32 {
    g().hole_solve(max_shots)
}
#[no_mangle]
pub extern "C" fn hole_start() -> u32 {
    g().hole_start()
}
#[no_mangle]
pub extern "C" fn restart() {
    g().restart()
}
#[no_mangle]
pub extern "C" fn shoot(angle_q: u32, power_q: u32, spin_q: u32) -> u32 {
    g().shoot(angle_q, power_q, spin_q)
}
#[no_mangle]
pub extern "C" fn advance(dt_ms: f64) -> u32 {
    g().advance(dt_ms)
}
#[no_mangle]
pub extern "C" fn settle() -> u32 {
    g().settle()
}
#[no_mangle]
pub extern "C" fn preview(angle_q: u32, power_q: u32, spin_q: u32) {
    g().preview(angle_q, power_q, spin_q)
}
#[no_mangle]
pub extern "C" fn preview_len() -> u32 {
    g().preview_n
}
#[no_mangle]
pub extern "C" fn bot_shot() -> u32 {
    g().bot_shot()
}
#[no_mangle]
pub extern "C" fn hash_lo() -> u32 {
    g().hash as u32
}
#[no_mangle]
pub extern "C" fn hash_hi() -> u32 {
    (g().hash >> 32) as u32
}
#[no_mangle]
pub extern "C" fn view_ptr() -> *const f64 {
    g().view.as_ptr()
}
#[no_mangle]
pub extern "C" fn heights_ptr() -> *const f64 {
    g().cur.h.as_ptr()
}
#[no_mangle]
pub extern "C" fn surf_ptr() -> *const u8 {
    g().cur.surf.as_ptr()
}
#[no_mangle]
pub extern "C" fn preview_ptr() -> *const f64 {
    g().preview.as_ptr()
}
#[no_mangle]
pub extern "C" fn tele_ptr() -> *const u32 {
    g().tele.as_ptr()
}
#[no_mangle]
pub extern "C" fn replay_buf_ptr() -> *mut u8 {
    g().replay.as_mut_ptr()
}
#[no_mangle]
pub extern "C" fn replay_encode() -> u32 {
    g().replay_encode()
}
/// Parse the replay buffer as untrusted input and re-simulate it on a separate
/// instance. 1 match, 0 differs, negative = invalid (codes in `Game::replay_parse`).
#[no_mangle]
pub extern "C" fn replay_verify(len: u32) -> i32 {
    let n = (len as usize).min(game::REPLAY_BUF);
    let mut raw = [0u8; 384];
    let r = Game::replay_parse(&g().replay[..n], &mut raw);
    if r < 0 {
        return r;
    }
    v().replay_verify(&raw, r as usize)
}
#[no_mangle]
pub extern "C" fn replay_seed() -> u32 {
    v().replay_seed
}
#[no_mangle]
pub extern "C" fn replay_summary_ptr() -> *const u32 {
    v().replay_summary.as_ptr()
}

#[cfg(not(test))]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    #[cfg(target_arch = "wasm32")]
    core::arch::wasm32::unreachable();
    #[cfg(not(target_arch = "wasm32"))]
    loop {}
}
