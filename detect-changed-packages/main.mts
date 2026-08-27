import * as core from "@actions/core";
import * as github from "@actions/github";

try {
    const pr = core.getInput("pr", { required: true });
    const octokit = github.getOctokit(core.getInput("token", { required: true }));

    const currentRepo = github.context.repo;
    let repoOwner = core.getInput("repo-owner", { required: false });
    if (repoOwner === "") {
        repoOwner = currentRepo.owner;
    }
    let repoName = core.getInput("repo-name", { required: false });
    if (repoName === "") {
        repoName = currentRepo.repo;
    }

    const changedFiles = await octokit.rest.pulls.listFiles({
        owner: repoOwner,
        repo: repoName,
        pull_number: pr as unknown as number,
    });

    for (const file of changedFiles.data) {
        console.log(file.filename);
    }
} catch (error) {
    if (!Error.isError(error)) throw error

    core.setFailed(error.message)
}
