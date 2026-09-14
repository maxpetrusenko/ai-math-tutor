from pathlib import Path


def test_production_incident_triage_runbook_exists_and_is_linked() -> None:
    readme = Path("README.md").read_text()
    doc_path = Path("docs/production-incident-triage.md")

    assert doc_path.is_file()
    assert "docs/production-incident-triage.md" in readme

    doc = doc_path.read_text()

    assert "# Production Incident Triage" in doc
    assert "## When to use this runbook" in doc
    assert "## Layer 1: DNS" in doc
    assert "## Layer 2: edge vs origin" in doc
    assert "## Layer 3: origin host (Coolify)" in doc
    assert "## Layer 4: application" in doc
    assert "## Decision matrix" in doc
    assert "## Evidence and escalation" in doc

    # DNS layer: local + DoH commands and NXDOMAIN interpretation.
    assert "dig +short" in doc
    assert "https://cloudflare-dns.com/dns-query" in doc
    assert "https://dns.google/resolve" in doc
    assert "NXDOMAIN" in doc
    assert "Status: 3" in doc

    # Edge layer: origin-direct probe and reverse-proxy signatures.
    assert "--resolve" in doc
    assert "173.249.52.27" in doc
    assert "no available server" in doc
    assert "page not found" in doc

    # Origin layer: capture before restart and app UUID caution.
    assert "before restarting" in doc
    assert "UUID" in doc

    # Application layer: canonical health checks and hosted smoke.
    assert "/api/runtime/status" in doc
    assert "/api/runtime-options" in doc
    assert "pnpm smoke:prod" in doc

    # Related runbook link and motivating incident.
    assert "docs/coolify-fast-deploy.md" in doc
    assert "#75" in doc

    # Decision matrix content (header plus separator row so the table cannot degrade to
    # literal text).
    assert "| Symptom |" in doc
    assert "| --- |" in doc
    assert "chatbox.maxpetrusenko.com" in doc
