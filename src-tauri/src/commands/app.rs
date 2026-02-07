//! App commands
//!
//! IPC handlers for application information.

use log::info;
use serde::Serialize;


/// Update check result
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_update: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Get app version
#[tauri::command]
pub fn get_version() -> String {
    // Version from Cargo.toml
    env!("CARGO_PKG_VERSION").to_string()
}

/// Check for updates
#[tauri::command]
pub async fn check_update() -> Result<UpdateCheckResult, String> {
    info!("Checking for updates");

    let current_version = get_version();

    // Check GitHub releases
    match check_github_release(&current_version).await {
        Ok(result) => Ok(result),
        Err(e) => Ok(UpdateCheckResult {
            success: false,
            has_update: None,
            current_version: Some(current_version),
            latest_version: None,
            release_url: None,
            release_notes: None,
            error: Some(e),
        }),
    }
}

/// Check GitHub for latest release
async fn check_github_release(current_version: &str) -> Result<UpdateCheckResult, String> {
    let client = reqwest::Client::builder()
        .user_agent("stream-client-gui")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get("https://api.github.com/repos/free-mba/Stream-Gate/releases/latest")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned status {}", response.status()));
    }

    let release: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    let latest_version = release["tag_name"]
        .as_str()
        .unwrap_or("0.0.0")
        .trim_start_matches('v')
        .to_string();

    let has_update = compare_versions(&latest_version, current_version) > 0;

    Ok(UpdateCheckResult {
        success: true,
        has_update: Some(has_update),
        current_version: Some(current_version.to_string()),
        latest_version: Some(latest_version),
        release_url: release["html_url"].as_str().map(String::from),
        release_notes: release["body"].as_str().map(String::from),
        error: None,
    })
}

/// Compare semantic versions
/// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
fn compare_versions(v1: &str, v2: &str) -> i32 {
    let parse_version = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .take(3)
            .filter_map(|p| {
                // Extract numeric part
                p.chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .ok()
            })
            .collect()
    };

    let parts1 = parse_version(v1);
    let parts2 = parse_version(v2);

    for i in 0..3 {
        let p1 = parts1.get(i).copied().unwrap_or(0);
        let p2 = parts2.get(i).copied().unwrap_or(0);

        if p1 > p2 {
            return 1;
        }
        if p1 < p2 {
            return -1;
        }
    }

    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compare_versions() {
        assert_eq!(compare_versions("1.0.0", "1.0.0"), 0);
        assert_eq!(compare_versions("1.1.0", "1.0.0"), 1);
        assert_eq!(compare_versions("1.0.0", "1.1.0"), -1);
        assert_eq!(compare_versions("2.0.0", "1.9.9"), 1);
        assert_eq!(compare_versions("v1.0.0", "1.0.0"), 0);
    }
}
