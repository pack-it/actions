import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { exec } from "@actions/exec";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

try {
    const version = core.getInput("version", { required: true });
    const revision = core.getInput("revision");
    const target = getTarget();
    const prefix = getPrefix();
    const configDir = getConfigDirectory();
    const packitPackagePrefix = path.join(prefix, "packages", "packit");
    core.info(`Installing Packit version ${version} (revision ${revision}) for target ${target}`);
    core.info(`Packit prefix: ${prefix}`);
    core.info(`Packit installation prefix: ${packitPackagePrefix}`);

    // Create prefix and config directory
    await createDirsPrivileged(packitPackagePrefix);
    await createDirsPrivileged(configDir);
    await setPermissions(prefix);
    await setPermissions(configDir);

    // Download Packit
    const tarFilename = `packit@${version}-${revision}-${target}`;
    const packitUrl = `https://github.com/pack-it/packit/releases/download/${version}/${tarFilename}.tar.gz`
    core.info(`Downloading Packit from ${packitUrl}`);
    const tarballPath = await tc.downloadTool(packitUrl);
    await tc.extractTar(tarballPath, packitPackagePrefix);
    
    // Rename extracted path to version, to ensure a correct installation path
    const packitInstallPrefix = path.join(packitPackagePrefix, version);
    moveDir(path.join(packitPackagePrefix, tarFilename), packitInstallPrefix);
    await setPermissions(prefix);

    core.info("Copied Packit files to the correct destination");

    // Initialize Packit (run privileged on Unix)
    const packitBinaryPath = path.join(packitInstallPrefix, "bin", `packit${getBinaryExtension()}`);
    await execFileSync(packitBinaryPath, ["init"], {
        stdio: "inherit",
    });

    // Add Packit bin to path
    const packitBin = path.join(prefix, "bin");
    core.addPath(packitBin);

    // Test if pit is in path
    await exec("pit", ["--version"]);
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

function getConfigDirectory(): string {
    switch(process.platform) {
        case "darwin":
            return "/Library/Application Support/packit";
        case "linux":
            return "/etc/packit";
        case "win32":
            return "C:\\Program Files\\packit";
        default:
            throw new Error(`Platform ${process.platform} is not supported by Packit!`);
    }
}

function getBinaryExtension(): string {
    switch(process.platform) {
        case "darwin":
        case "linux":
            return "";
        case "win32":
            return ".exe";
        default:
            throw new Error(`Platform ${process.platform} is not supported by Packit!`);
    }
}

async function createDirsPrivileged(dir: string) {
    if (fs.existsSync(dir)) return;

    if (process.platform == "win32") {
        await exec("mkdir", ["-p", dir]);
    } else {
        await exec("sudo", ["mkdir", "-p", dir]);
    }
}

async function setPermissions(dir: string) {
    if (process.platform == "win32") return;

    await exec("sudo", ["chmod", "-R", "755", dir]);
    await exec("sudo", ["chown", "-R", os.userInfo().uid.toString(), dir]);
}

function moveDir(source: string, destination: string) {
    try {
        fs.renameSync(source, destination);
    } catch(error: any) {
        if (error.code !== "EXDEV") throw error;

        fs.cpSync(source, destination, { recursive: true });
        fs.rmSync(source, { recursive: true });
    }
}
