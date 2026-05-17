fn main() {
    let code = dslinter::cli::run_cli(std::env::args().collect());
    std::process::exit(code);
}
