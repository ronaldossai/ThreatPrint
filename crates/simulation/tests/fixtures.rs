//! Every bundled scenario fixture must deserialise into the engine's schema
//! and pass validation, with unique scenario ids. This keeps the JSON shared with the UI honest.

use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use threatprint_sim::Scenario;

#[test]
fn bundled_scenarios_are_valid() {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/scenarios");
    let mut ids = HashSet::new();
    for entry in fs::read_dir(&dir).expect("fixtures/scenarios exists") {
        let path = entry.unwrap().path();
        if path.extension().is_some_and(|e| e == "json") {
            let text = fs::read_to_string(&path).unwrap();
            let scenario: Scenario = serde_json::from_str(&text)
                .unwrap_or_else(|e| panic!("{} failed to parse: {e}", path.display()));
            scenario
                .validate()
                .unwrap_or_else(|e| panic!("{} is invalid: {e}", path.display()));
            assert!(ids.insert(scenario.id.clone()), "duplicate scenario id `{}`", scenario.id);
        }
    }
    assert!(!ids.is_empty(), "expected at least one scenario fixture");
}
