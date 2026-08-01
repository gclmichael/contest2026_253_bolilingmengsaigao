#!/usr/bin/env bash

set -euo pipefail

workspace="${FOCUSLOOP_VELA_ROOT:-/home/michael/openvela-contest}"
build_dir="${workspace}/cmake_out/vela_goldfish-arm64-v8a-ap"
runtime_dir="${FOCUSLOOP_RUNTIME_DIR:-/tmp/focusloop-goldfish}"
pid_file="${runtime_dir}/emulator.pid"
log_file="${runtime_dir}/emulator.log"

mkdir -p "${runtime_dir}"

if [[ -f "${pid_file}" ]]; then
  previous_pid="$(cat "${pid_file}")"
  if [[ -n "${previous_pid}" ]] && kill -0 "${previous_pid}" 2>/dev/null; then
    echo "Goldfish is already running with PID ${previous_pid}"
    exit 0
  fi
fi

cd "${workspace}"
nohup setsid ./emulator.sh "${build_dir}/" \
  -port 5554 \
  -grpc 8554 \
  >"${log_file}" 2>&1 </dev/null &

emulator_pid=$!
echo "${emulator_pid}" >"${pid_file}"
echo "Started Goldfish with PID ${emulator_pid}"
echo "Log: ${log_file}"
