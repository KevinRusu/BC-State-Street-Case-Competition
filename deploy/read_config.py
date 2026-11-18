"""Prints config/hosting.toml (or the file named by env HOSTING_CONFIG) as KEY=<quoted value> lines for `eval`.

Used by deploy/deploy.sh and deploy/check-live.sh. Exits 1 when project or region is empty.
"""
import os
import shlex
import sys
import tomllib
from pathlib import Path

root = Path(__file__).resolve().parent.parent
path = Path(os.environ.get("HOSTING_CONFIG") or root / "config" / "hosting.toml")
with open(path, "rb") as f:
    cfg = tomllib.load(f)

google, service = cfg.get("google", {}), cfg.get("service", {})
registry, secret = cfg.get("registry", {}), cfg.get("secret", {})
project = str(google.get("project", "")).strip()
region = str(google.get("region", "")).strip()
if not project or not region:
    print("fill in config/hosting.toml: project and region", file=sys.stderr)
    sys.exit(1)

values = {
    "PROJECT": project,
    "REGION": region,
    "SERVICE": service.get("name", "dashboard"),
    "MEMORY": service.get("memory", "2Gi"),
    "CPU": service.get("cpu", 1),
    "MAX_INSTANCES": service.get("max_instances", 1),
    "MIN_INSTANCES": service.get("min_instances", 0),
    "CONCURRENCY": service.get("concurrency", 80),
    "REPOSITORY": registry.get("repository", "dashboard"),
    "KEEP_IMAGES": registry.get("keep_images", 2),
    "SECRET": secret.get("name", "dashboard-password"),
    "BUCKET": f"{project}-dashboard-uploads",
}
for key, value in values.items():
    print(f"{key}={shlex.quote(str(value))}")
