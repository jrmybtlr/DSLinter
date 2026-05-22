//! Compile-once regex helpers.

#[macro_export]
macro_rules! lazy_regex {
    ($vis:vis $name:ident, $pat:literal) => {
        $vis fn $name() -> &'static ::regex::Regex {
            static RE: ::std::sync::OnceLock<::regex::Regex> = ::std::sync::OnceLock::new();
            RE.get_or_init(|| {
                ::regex::Regex::new($pat).expect(concat!(stringify!($name), " regex"))
            })
        }
    };
}
