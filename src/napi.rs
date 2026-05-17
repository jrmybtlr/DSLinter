//! Node-API bindings for the `dslinter` npm package.

use napi_derive::napi;

#[napi]
pub fn run_cli(args: Vec<String>) -> napi::Result<i32> {
    Ok(crate::cli::run_cli(args))
}
