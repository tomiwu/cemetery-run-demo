#!/usr/bin/env bash
# Download the third-party files from the release `asset-sources-v1`, check SHA-256 and copy
# them to public/assets/. Run from any folder. Needs: bash, curl, sha256sum (GNU) and perl.
# A second run gives no change in public/assets/ (the checksums match).
set -euo pipefail

BASE_URL="https://github.com/tomiwu/cemetery-run-demo/releases/download/asset-sources-v1/"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/public/assets"
MODELS_LIST="$ROOT/scripts/assets-models.txt"
ZIP_NAME="kenney_graveyard-kit.zip"
ZIP_MODELS_DIR="Models/GLB format"

FILES=(
  Fraunces-latin.woff2
  NunitoSans-latin.woff2
  OFL-Fraunces.txt
  OFL-NunitoSans.txt
  void_estate_haunted_arcade.mp3
  void_estate.mp3
  "$ZIP_NAME"
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Download to $TMP"
for name in SHA256SUMS "${FILES[@]}"; do
  curl --fail --silent --show-error --location --output "$TMP/$name" "$BASE_URL$name"
done

echo "Check SHA-256"
(cd "$TMP" && sha256sum -c --ignore-missing SHA256SUMS)
# Make sure that each file we need is in the list. --ignore-missing alone would skip a gap.
for name in "${FILES[@]}"; do
  grep -q "  $name\$" "$TMP/SHA256SUMS" || {
    echo "No checksum for $name" >&2
    exit 1
  }
done

mkdir -p "$OUT/fonts" "$OUT/audio" "$OUT/models/Textures"

cp "$TMP/Fraunces-latin.woff2" "$TMP/NunitoSans-latin.woff2" \
  "$TMP/OFL-Fraunces.txt" "$TMP/OFL-NunitoSans.txt" "$OUT/fonts/"
cp "$TMP/void_estate_haunted_arcade.mp3" "$TMP/void_estate.mp3" "$OUT/audio/"

# Build the list of "zip member<TAB>destination" lines.
MAP="$TMP/extract-map.tsv"
: >"$MAP"
while IFS= read -r name || [ -n "$name" ]; do
  [ -n "$name" ] || continue
  printf '%s/%s.glb\t%s\n' "$ZIP_MODELS_DIR" "$name" "$OUT/models/$name.glb" >>"$MAP"
done <"$MODELS_LIST"
printf '%s/Textures/colormap.png\t%s\n' "$ZIP_MODELS_DIR" "$OUT/models/Textures/colormap.png" >>"$MAP"
printf 'License.txt\t%s\n' "$OUT/models/License-Kenney.txt" >>"$MAP"

# perl (core module IO::Uncompress::Unzip) reads the zip. Each member must be in the zip.
perl -MIO::Uncompress::Unzip=\$UnzipError -e '
  my ($zip, $map) = @ARGV;
  open(my $fh, "<", $map) or die "Cannot read $map\n";
  my %dest = map { chomp; split /\t/, $_, 2 } <$fh>;
  my $z = IO::Uncompress::Unzip->new($zip) or die "Cannot open $zip: $UnzipError\n";
  my $status;
  do {
    my $name = $z->getHeaderInfo->{Name};
    if (exists $dest{$name}) {
      open(my $out, ">", $dest{$name}) or die "Cannot write $dest{$name}\n";
      binmode $out;
      my $buf;
      print $out $buf while $z->read($buf) > 0;
      close $out;
      delete $dest{$name};
    }
  } while (($status = $z->nextStream) > 0);
  die "Zip error: $UnzipError\n" if $status < 0;
  die "Not in zip: " . join(", ", sort keys %dest) . "\n" if %dest;
' "$TMP/$ZIP_NAME" "$MAP"

echo "Done. Files in $OUT:"
(cd "$OUT" && find . -type f | sort | wc -l)
du -sh "$OUT"
