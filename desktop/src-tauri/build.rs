fn main() {
    println!("cargo:rerun-if-changed=companion/companion.apk");
    tauri_build::build()
}
