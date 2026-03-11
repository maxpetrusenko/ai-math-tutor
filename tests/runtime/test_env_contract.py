from backend.runtime.env_contract import collect_env_contract_errors


def test_local_env_contract_allows_default_local_websocket_without_firebase_auth() -> None:
    errors = collect_env_contract_errors(mode="local", env={})

    assert errors == []


def test_prod_env_contract_requires_firebase_config_when_auth_is_enabled() -> None:
    errors = collect_env_contract_errors(
        mode="prod",
        env={
            "NERDY_REQUIRE_FIREBASE_AUTH": "1",
            "NEXT_PUBLIC_SESSION_WS_URL": "wss://example.com/ws/session",
        },
    )

    assert errors == [
        "Firebase auth requires FIREBASE_WEBAPP_CONFIG, NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG, or the full NEXT_PUBLIC_FIREBASE_* set."
    ]


def test_prod_env_contract_accepts_runtime_json_config() -> None:
    errors = collect_env_contract_errors(
        mode="prod",
        env={
            "FIREBASE_WEBAPP_CONFIG": '{"apiKey":"key","appId":"app","authDomain":"demo.firebaseapp.com","messagingSenderId":"123","projectId":"demo","storageBucket":"demo.appspot.com"}',
            "NERDY_REQUIRE_FIREBASE_AUTH": "1",
            "NEXT_PUBLIC_SESSION_WS_URL": "wss://example.com/ws/session",
        },
    )

    assert errors == []
