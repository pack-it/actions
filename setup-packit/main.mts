import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import fs from "node:fs";
import path from "node:path";

try {
    const version = core.getInput("version", { required: true });
    const revision = core.getInput("revision");
    const target = getTarget();
    const prefix = getPrefix();
    const packitInstallPrefix = path.join(prefix, "packages", "packit", version);
    core.info(`Installing Packit version ${version} (revision ${revision}) for target ${target}`);
    core.info(`Packit prefix: ${prefix}`);
    core.info(`Packit installation prefix: ${prefix}`);

    // Create prefix directory
    fs.mkdir(packitInstallPrefix, { recursive: true }, (error) => {
        if (error) throw error;
    });

    const packitUrl = `https://github.com/pack-it/packit/releases/download/${version}/packit@${version}-${revision}-${target}.tar.gz`
    core.info(`Downloading Packit from ${packitUrl}`);

    const tarballPath = await tc.downloadTool(packitUrl);
    await tc.extractTar(tarballPath, packitInstallPrefix);
} catch (error) {
    if (!Error.isError(error)) throw error

    core.setFailed(error.message)
}

function getTarget(): string {
    switch(process.platform) {
        case "darwin":
            switch(process.arch) {
                case "x64":
                    return "x86_64-apple-darwin";
                case "arm64":
                    return "aarch64-apple-darwin";
                default:
                    throw new Error(`Architecture ${process.arch} is not supported by Packit!`);
            }
        case "linux":
            // TODO: check libc implementation
            switch(process.arch) {
                case "x64":
                    return "x86_64-unknown-linux-gnu";
                case "arm64":
                    return "aarch64-unknown-linux-gnu";
                default:
                    throw new Error(`Architecture ${process.arch} is not supported by Packit!`);
            }
        case "win32":
            switch(process.arch) {
                case "x64":
                    return "x86_64-pc-windows-msvc";
                case "arm64":
                    return "aarch64-pc-windows-msvc";
                default:
                    throw new Error(`Architecture ${process.arch} is not supported by Packit!`);
            }
        default:
            throw new Error(`Platform ${process.platform} is not supported by Packit!`);
    }
}

function getPrefix(): string {
    switch(process.platform) {
        case "darwin":
        case "linux":
            return "/opt/packit";
        case "win32":
            return "C:\\Program Files\\packit";
        default:
            throw new Error(`Platform ${process.platform} is not supported by Packit!`);
    }
}
