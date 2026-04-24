from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from chatlog_studio.visual import main


def _normalized_argv() -> list[str]:
    argv = list(sys.argv[1:])
    if argv and argv[0].lower() == "ui":
        return argv[1:]
    return argv


if __name__ == "__main__":
    raise SystemExit(main(_normalized_argv()))
