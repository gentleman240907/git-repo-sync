export function logStep(repo, branch, message) {
  const repoLabel = repo ? `[${repo}]` : '';
  const branchLabel = branch ? ` (${branch})` : '';
  console.log(`${repoLabel}${branchLabel} ${message}`);
}

export function logInfo(message) {
  console.log(message);
}

export function logError(message, err) {
  console.error(message);
  if (err?.message) {
    console.error(err.message);
  }
}
