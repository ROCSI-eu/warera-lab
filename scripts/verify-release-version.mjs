import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const versionPattern = /^v(\d+)\.(\d+)\.(\d+)$/;

function fail(message) {
  throw new Error("release version verification failed: " + message);
}

function parseVersion(value) {
  const match = versionPattern.exec(value);
  if (!match) fail('invalid version "' + value + '"');
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (minor > 99 || patch > 99) {
    fail("version components must remain within 0..99 before the next rollover: " + value);
  }
  return { major, minor, patch };
}

function nextSequentialVersion(value) {
  const { major, minor, patch } = parseVersion(value);
  if (major >= 1) fail("automatic post-1.0 version progression is intentionally undefined");
  if (minor === 99 && patch === 99) fail("v1.0.0 requires an explicit product decision");
  if (patch < 99) return "v" + major + "." + minor + "." + (patch + 1);
  return "v" + major + "." + (minor + 1) + ".0";
}

for (const [current, expected] of [
  ["v0.0.1", "v0.0.2"],
  ["v0.0.98", "v0.0.99"],
  ["v0.0.99", "v0.1.0"],
  ["v0.1.99", "v0.2.0"],
]) {
  if (nextSequentialVersion(current) !== expected) fail("rollover rule mismatch for " + current);
}

const version = (await readFile(new URL("VERSION", root), "utf8")).trim();
parseVersion(version);

const changelog = await readFile(new URL("CHANGELOG.md", root), "utf8");
const headings = [...changelog.matchAll(/^## (v\d+\.\d+\.\d+) — \d{4}-\d{2}-\d{2}$/gm)].map(
  (match) => match[1],
);
if (headings.length < 2) fail("CHANGELOG.md must contain the current release and a prior release");
if (headings[0] !== version) {
  fail("CHANGELOG.md latest release is " + (headings[0] ?? "missing") + ", expected " + version);
}
if (nextSequentialVersion(headings[1]) !== version) {
  fail("current version " + version + " is not the next sequential release after " + headings[1]);
}

const currentStart = changelog.indexOf("## " + version + " —");
const previousStart = changelog.indexOf("\n## " + headings[1] + " —", currentStart);
const currentEntry = changelog.slice(
  currentStart,
  previousStart === -1 ? changelog.length : previousStart,
);

for (const required of [
  "**Production commit:**",
  "**Previous version:**",
  "**Environment:**",
  "### Summary",
  "### Added",
  "### Changed",
  "### Fixed",
  "### Verification",
  "### Known limitations",
  "### References",
]) {
  if (!currentEntry.includes(required))
    fail('current changelog entry is missing "' + required + '"');
}

const commitLine = currentEntry.match(/^\*\*Production commit:\*\* (.+)$/m)?.[1]?.trim();
if (
  !commitLine ||
  (!/^`[a-f0-9]{40}`$/.test(commitLine) &&
    commitLine !== "Pending production deployment — finalize after successful deploy/tag.")
) {
  fail(
    "current changelog Production commit must be a 40-character SHA or the approved pre-deploy placeholder",
  );
}

const readme = await readFile(new URL("README.md", root), "utf8");
for (const reference of [
  "[VERSION](VERSION)",
  "[CHANGELOG.md](CHANGELOG.md)",
  "[docs/RELEASES.md](docs/RELEASES.md)",
]) {
  if (!readme.includes(reference)) fail("README.md must reference " + reference);
}

console.log("release version verified: " + version);
