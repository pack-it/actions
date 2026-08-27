import * as core from "@actions/core";
import * as github from "@actions/github";

try {
    const pr = core.getInput("pr", { required: true });
    const octokit = github.getOctokit(core.getInput("token", { required: true }));

    // Retrieve repo to check from inputs
    const currentRepo = github.context.repo;
    let repoOwner = core.getInput("repo-owner", { required: false });
    if (repoOwner === "") {
        repoOwner = currentRepo.owner;
    }
    let repoName = core.getInput("repo-name", { required: false });
    if (repoName === "") {
        repoName = currentRepo.repo;
    }

    // Request all changed files from GitHub
    const changedFiles = await octokit.rest.pulls.listFiles({
        owner: repoOwner,
        repo: repoName,
        pull_number: pr as unknown as number,
    });

    let changedPackages = new Set();

    // Extract package ids from changed files
    const packageRegex = new RegExp("packages\/([a-zA-Z0-9\-_]+)\/([^\n]+)");
    const versionRegex = new RegExp("packages\/([a-zA-Z0-9\-_]+)\/([0-9\.]+)\/([^\n]+)");
    for (const file of changedFiles.data) {
        // Check if file corresponds to a package version
        const versionMatches = versionRegex.exec(file.filename);
        if (versionMatches !== null) {
            changedPackages.add(`${versionMatches[1]}@${versionMatches[2]}`);
            continue;
        }

        // Check if file corresponds to a package
        const packageMatches = packageRegex.exec(file.filename);
        if (packageMatches !== null) {
            // Skip changes to the package.toml file, as they do not necessarily mean the build has changed
            if (packageMatches[1] === "package.toml") {
                continue;
            }

            // TODO: retrieve all versions from package.toml
            changedPackages.add(`${packageMatches[1]}@0.0.0`);
            continue;
        }

        // Show a message if a file does not seem to be a metadata file
        core.info(`File ${file.filename} does not seem to be a metadata file.`);
    }

    for (const pkg of changedPackages) {
        console.log(pkg);
    }
} catch (error) {
    if (!Error.isError(error)) throw error

    core.setFailed(error.message)
}
