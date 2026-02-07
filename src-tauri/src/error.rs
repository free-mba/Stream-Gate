//! Error types for Stream Gate
//!
//! This module defines custom error types used throughout the application.

use serde::Serialize;
use std::fmt;

/// Application error type
#[derive(Debug, Serialize)]
pub struct AppError {
    pub message: String,
    pub code: Option<String>,
}

impl AppError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_code(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: Some(code.into()),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::new(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::new(err.to_string())
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::new(s)
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::new(s)
    }
}

/// Result type alias for application operations
pub type AppResult<T> = Result<T, AppError>;
