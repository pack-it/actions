import * as core from "@actions/core";
import * as github from "@actions/github";
import { parse as parseToml } from "smol-toml";

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

    // Get PR from GitHub
    const repoPr = await octokit.rest.pulls.get({
        owner: repoOwner,
        repo: repoName,
        pull_number: pr as unknown as number,
    });
    const prHead = repoPr.data.head;

    // Request all changed files from GitHub
    const changedFiles = await octokit.rest.pulls.listFiles({
        owner: repoOwner,
        repo: repoName,
        pull_number: pr as unknown as number,
    });

    let changedPackages = new Set();

    // Extract package ids from changed files
    const packageRegex = new RegExp("^([^\n]+\/)?packages\/([a-zA-Z0-9\-_]+)\/([^\n]+)");
    const versionRegex = new RegExp("^([^\n]+\/)?packages\/([a-zA-Z0-9\-_]+)\/([0-9\.]+)\/([^\n]+)");
    for (const file of changedFiles.data) {
        // Check if file corresponds to a package version
        const versionMatches = versionRegex.exec(file.filename);
        if (versionMatches !== null) {
            const packageName = versionMatches[2];
            const packageVersion = versionMatches[3];

            changedPackages.add(`${packageName}@${packageVersion}`);
            continue;
        }

        // Check if file corresponds to a package
        const packageMatches = packageRegex.exec(file.filename);
        if (packageMatches !== null) {
            const pathPrefix = packageMatches[1] || "";
            const packageName = packageMatches[2];
            const fileName = packageMatches[3];
            
            // Skip changes to the package.toml file, as they do not necessarily mean the build has changed
            if (fileName === "package.toml") {
                continue;
            }

            // Get content of package.toml file
            const packageFile = await octokit.rest.repos.getContent({
                owner: prHead.repo.owner.login,
                repo: prHead.repo.name,
                ref: prHead.sha,
                path: `${pathPrefix}packages/${packageName}/package.toml`,
            });
            if (Array.isArray(packageFile.data) || packageFile.data.type !== "file") {
                console.error(`Cannot retrieve package.toml file of package ${packageName}`)
                continue;
            }
            let fileContent = Buffer.from(packageFile.data.content, "base64").toString("utf8");

            // Parse toml file and get versions
            let toml = parseToml(fileContent);
            let availableVersions = toml["versions"];
            if (!Array.isArray(availableVersions) || !availableVersions.every(item => typeof item === "string")) {
                console.error(`Cannot retrieve versions from package.toml file of package ${packageName}`)
                continue;
            }

            // Add all versions to the list of changed packages
            for (const version of availableVersions) {
                changedPackages.add(`${packageName}@${version}`);
            }
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
