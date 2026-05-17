fn main() {
    // Package features are exposed to build.rs via CARGO_FEATURE_* env vars, not #[cfg(feature)].
    if std::env::var("CARGO_FEATURE_NAPI").is_ok() {
        napi_build::setup();
    }
}
