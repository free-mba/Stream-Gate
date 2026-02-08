
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_import_specific_string() {
        let input = "ssgate:Qweqweqwe//eyJjb3VudHJ5Ijoi8J+Ps++4jyIsImRvbWFpbiI6InMuY2FwbWlwYS5vbmxpbmUiLCJyZW1hcmsiOiJRd2Vxd2Vxd2UiLCJzb2NrcyI6eyJwYXNzd29yZCI6IkJNYVAlNXhDOTc+IyIsInVzZXJuYW1lIjoibWVyY3VyYWlsIn19";
        
        // Mocking the behavior inside import_configs loop
        let line = input;
        if let Some(idx) = line.find("//") {
            let base64_str = &line[idx+2..];
            use base64::{Engine as _, engine::general_purpose};
            
            println!("Attempting to decode: '{}'", base64_str);
            
            match general_purpose::STANDARD.decode(base64_str) {
                Ok(bytes) => {
                     println!("Decoded {} bytes", bytes.len());
                     let s = String::from_utf8(bytes).unwrap();
                     println!("JSON: {}", s);
                }
                Err(e) => {
                    panic!("Decoding failed: {}", e);
                }
            }
        } else {
            panic!("Could not find separator");
        }
    }
}
