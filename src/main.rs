fn main() {
    let code = dslinter::cli::run_cli(std::env::args().skip(1).collect());
    std::process::exit(code);
}
