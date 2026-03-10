from importlib import import_module


def test_backend_packages_import_cleanly() -> None:
    assert import_module("backend")
    assert import_module("backend.benchmarks")
    assert import_module("backend.monitoring")
