#!/usr/bin/env bash
# 从 selfhst/icons（经 jsdelivr CDN）拉取系统 Logo 到 public/assets/os/<key>.svg
set -u
cd "$(dirname "$0")/.."
mkdir -p public/assets/os

fetch_key() { # $1=key  $2..=候选名
  local key="$1"; shift
  for name in "$@"; do
    for base in "svg/$name.svg" "png/$name.png"; do
      out="public/assets/os/$key.svg"
      if curl -fsSL --max-time 25 -o "$out" "https://cdn.jsdelivr.net/gh/selfhst/icons@master/$base" 2>/dev/null; then
        head1="$(head -c 100 "$out" | tr -d '\0')"
        case "$head1" in
          *"<svg"*|*"<?xml"*)
            echo "OK  $key <- $base ($(wc -c <"$out") bytes)"; return 0 ;;
          *)
            rm -f "$out" ;;
        esac
      fi
    done
  done
  echo "MISS $key"
  return 1
}

fetch_key debian debian
fetch_key ubuntu ubuntu
fetch_key centos centos centos-linux
fetch_key rocky rocky-linux rockylinux
fetch_key almalinux almalinux alma-linux
fetch_key alpine alpine-linux alpinelinux alpine
fetch_key arch arch-linux archlinux arch
fetch_key fedora fedora
fetch_key freebsd freebsd
fetch_key opensuse opensuse open-suse
fetch_key windows windows-11 windows-10 windows
fetch_key macos macos apple mac
fetch_key docker docker
fetch_key proxmox proxmox
fetch_key oracle oracle-linux oracle
fetch_key raspbian raspberry-pi raspberrypi raspbian
fetch_key kali kali-linux kali
fetch_key redhat redhat red-hat
fetch_key gentoo gentoo
fetch_key nixos nixos
fetch_key openwrt openwrt
fetch_key deepin deepin
fetch_key linux linux tux
