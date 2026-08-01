#!/usr/bin/env bash

set -euo pipefail

sudo apt update
sudo apt install -y \
  build-essential \
  cmake \
  curl \
  git \
  git-lfs \
  libc++abi-dev \
  ninja-build \
  python3 \
  python3-pip \
  unzip

git lfs install

install -d "$HOME/.local/bin"
curl -fsSL "https://storage.googleapis.com/git-repo-downloads/repo" \
  -o "$HOME/.local/bin/repo"
chmod +x "$HOME/.local/bin/repo"

case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *)
    printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.bashrc"
    ;;
esac

echo "Ubuntu development dependencies are ready."
echo "Open a new shell or run: export PATH=\"$HOME/.local/bin:$PATH\""
